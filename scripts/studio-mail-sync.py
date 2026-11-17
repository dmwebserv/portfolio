"""IONOS bridge; stdlib only. Never print bodies, addresses or credentials.
Scheduled GitHub Actions are best effort, NOT an always-on/instant mail service.
"""
import os, json, ssl, smtplib, imaplib, uuid, re
from email.message import EmailMessage
from email.parser import BytesParser
from email import policy
from email.utils import formatdate, parseaddr
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from datetime import datetime, timezone


def api(path, method='GET', data=None):
    base=os.environ['SUPABASE_URL'].rstrip('/')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',base):
        raise ValueError('Invalid Supabase origin')
    key=os.environ['SUPABASE_SERVICE_KEY']
    req=Request(base+'/rest/v1/'+path,method=method,headers={
        'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json',
        'Prefer':'return=representation'},data=None if data is None else json.dumps(data).encode())
    with urlopen(req,timeout=30) as r:
        raw=r.read()
        return json.loads(raw) if raw else None


def query(table, **filters):
    return api(table+'?'+urlencode(filters))


def update(row, status, detail='', message_id=None):
    data={'status':status,'detail':detail,'updated_at':datetime.now(timezone.utc).isoformat()}
    if message_id: data['message_id']=message_id
    return api('studio_mail?'+urlencode({'id':'eq.'+row['id'],'owner_id':'eq.'+row['owner_id']}),'PATCH',data)


def project_allowed(row):
    work=query('studio_workspaces',owner_id='eq.'+row['owner_id'],select='projects')
    p=next((p for p in work[0]['projects'] if p['id']==row['project_id']),None) if work else None
    lines=(p.get('outreachDraft','') if p else '').split('\n')
    unchanged=lines[0].removeprefix('Subject:').strip()==row['subject'] and '\n'.join(lines[1:]).strip()==row['body']
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(row['created_at'].replace('Z','+00:00'))).total_seconds()
    return bool(unchanged and age<86400 and p and p.get('stage') not in ('Do not contact','Not interested') and
                p.get('email','').lower()==row['recipient'].lower() and
                all(p.get('checks',{}).get(k) for k in ('demo','facts','contact','eligibility','email')))


def send(row):
    # Claim before contacting SMTP. No automatic retry after any ambiguous outcome.
    claimed=api('rpc/studio_claim_mail','POST',{'mail_id':row['id']})
    if not claimed: return
    mid='<'+str(uuid.uuid4())+'@'+os.environ['MAIL_USERNAME'].split('@')[1]+'>'
    try:
        if not project_allowed(row):
            update(row,'failed','Cancelled: project removed, opted out, recipient changed or reviews reopened.')
            return
        if query('studio_mail',owner_id='eq.'+row['owner_id'],project_id='eq.'+row['project_id'],direction='eq.inbound',limit=1):
            update(row,'failed','Cancelled: reply recorded. Review conversation in mailbox.');return
        msg=EmailMessage()
        msg['From']=os.environ['MAIL_USERNAME'];msg['To']=row['recipient']
        msg['Subject']=row['subject'];msg['Date']=formatdate(localtime=False);msg['Message-ID']=mid
        msg.set_content(row['body'])
        # Persist message ID BEFORE SMTP so replies can correlate even after a crash.
        update(row,'sending','Attempt started; do not manually resend.',mid)
        with smtplib.SMTP_SSL('smtp.ionos.co.uk',465,timeout=40,context=ssl.create_default_context()) as smtp:
            smtp.login(os.environ['MAIL_USERNAME'],os.environ['MAIL_PASSWORD'])
            smtp.send_message(msg)
        update(row,'accepted','Accepted by IONOS SMTP. This is not proof of delivery.',mid)
        # SMTP does not guarantee a Sent-folder copy. Append it separately, once.
        try:
            with imaplib.IMAP4_SSL('imap.ionos.co.uk',993,ssl_context=ssl.create_default_context(),timeout=30) as box:
                box.login(os.environ['MAIL_USERNAME'],os.environ['MAIL_PASSWORD'])
                status,folders=box.list()
                sent=next((line.split(b' "/" ',1)[1].decode().strip('"') for line in folders or [] if b'\\Sent' in line and b' "/" ' in line), 'Sent')
                status,_=box.append(sent,'\\Seen',None,msg.as_bytes())
                if status!='OK': raise RuntimeError('append failed')
        except Exception:
            update(row,'accepted','SMTP accepted; Sent-folder copy failed. Studio retains the message. Do not resend.',mid)
    except Exception:
        # Auth/network/timeout may be pre- or post-acceptance: never guess/retry.
        update(row,'uncertain','Send outcome uncertain. Check IONOS Sent/recipient before any manual retry.',mid)


def plain(msg):
    part=msg.get_body(preferencelist=('plain',)) if msg.is_multipart() else msg
    if not part or part.get_content_type()!='text/plain':return '[No plain-text body. View this reply in your mailbox.]'
    try:return str(part.get_content())[:30000]
    except Exception:return '[Unable to decode reply; view in mailbox.]'


def sync_replies(owner):
    sent=query('studio_mail',owner_id='eq.'+owner,direction='eq.outbound',select='project_id,message_id,recipient',limit=1000)
    ids={m['message_id']:m for m in sent if m.get('message_id')}
    with imaplib.IMAP4_SSL('imap.ionos.co.uk',993,ssl_context=ssl.create_default_context(),timeout=30) as box:
        box.login(os.environ['MAIL_USERNAME'],os.environ['MAIL_PASSWORD'])
        status,_=box.select('INBOX',readonly=True)
        if status!='OK':raise RuntimeError('inbox unavailable')
        if not ids:return
        status,data=box.uid('search',None,'ALL')
        if status!='OK':raise RuntimeError('search failed')
        # Bounded scan; no attachments downloaded, no messages marked read.
        for uid in data[0].split()[-150:]:
            status,parts=box.uid('fetch',uid,'(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID IN-REPLY-TO REFERENCES FROM SUBJECT)])')
            if status!='OK':continue
            raw=next((x[1] for x in parts if isinstance(x,tuple)),b'')
            header=BytesParser(policy=policy.default).parsebytes(raw)
            refs=re.findall(r'<[^<>\s]+>',str(header.get('In-Reply-To',''))+' '+str(header.get('References','')))
            match=next((ids[r] for r in reversed(refs) if r in ids),None)
            if not match:continue
            # Also verify sender. Forwarded/changed-address replies need manual review.
            if parseaddr(str(header.get('From','')))[1].lower()!=match['recipient'].lower():continue
            message_id=str(header.get('Message-ID',''))[:1000]
            if not message_id:continue
            dedupe='inbound:'+message_id
            if query('studio_mail',owner_id='eq.'+owner,dedupe='eq.'+dedupe,select='id',limit=1):continue
            status,parts=box.uid('fetch',uid,'(RFC822.SIZE)')
            size=re.search(rb'RFC822.SIZE (\d+)',b' '.join(x for x in parts if isinstance(x,bytes)))
            if not size or int(size[1])>250000:continue
            status,parts=box.uid('fetch',uid,'(BODY.PEEK[])')
            raw=next((x[1] for x in parts if isinstance(x,tuple)),b'')
            msg=BytesParser(policy=policy.default).parsebytes(raw)
            api('studio_mail','POST',{'owner_id':owner,'project_id':match['project_id'],'direction':'inbound','recipient':os.environ['MAIL_USERNAME'],'subject':str(msg.get('Subject',''))[:250],'body':plain(msg),'dedupe':dedupe,'message_id':message_id,'status':'received','detail':'Matched message references and sender; not proof of sender authenticity.'})


def main():
    if os.environ.get('STUDIO_MAIL_ENABLED')!='true':
        print('Mailbox sync disabled. No mail connection attempted.');return
    required=('SUPABASE_URL','SUPABASE_SERVICE_KEY','MAIL_OWNER_ID','MAIL_USERNAME','MAIL_PASSWORD')
    if any(not os.environ.get(k) for k in required):raise RuntimeError('Missing mail configuration')
    owner=os.environ['MAIL_OWNER_ID']
    if not query('studio_owners',user_id='eq.'+owner,select='user_id'):raise RuntimeError('Owner not authorised')
    # Scan replies BEFORE sending. A sync failure fails closed: no queued mail sent.
    sync_replies(owner)
    rows=query('studio_mail',owner_id='eq.'+owner,direction='eq.outbound',status='eq.queued',order='created_at.asc',limit=5)
    for row in rows:send(row)
    print('Mailbox sync completed. Check Studio for individual message states.')

if __name__=='__main__':
    try:main()
    except Exception:
        # Suppress exception payloads: mail addresses and service responses are private.
        print('Mailbox sync failed. No automatic retry of claimed sends. Check configuration and Studio states.')
        raise SystemExit(1)
