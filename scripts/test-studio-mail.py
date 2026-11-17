"""No network, credentials or real mail used."""
import importlib.util, unittest, os
from unittest.mock import patch, MagicMock
from email.message import EmailMessage
from datetime import datetime,timezone
spec=importlib.util.spec_from_file_location('bridge','scripts/studio-mail-sync.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MailTests(unittest.TestCase):
 def setUp(self):
  self.row={'id':'row','owner_id':'owner','project_id':'p','recipient':'test@example.com','subject':'Hello','body':'Text','created_at':datetime.now(timezone.utc).isoformat()}
 def test_disabled(self):
  with patch.dict(os.environ,{'STUDIO_MAIL_ENABLED':'false'}),patch.object(m,'api') as api:m.main();api.assert_not_called()
 def test_already_claimed(self):
  with patch.object(m,'api',return_value=[]),patch.object(m.smtplib,'SMTP_SSL') as smtp:m.send(self.row);smtp.assert_not_called()
 def test_changed_project(self):
  with patch.dict(os.environ,{'MAIL_USERNAME':'danny@example.com'}),patch.object(m,'api',return_value=[self.row]),patch.object(m,'project_allowed',return_value=False),patch.object(m,'update') as update,patch.object(m.smtplib,'SMTP_SSL') as smtp:
   m.send(self.row);self.assertEqual(update.call_args.args[1],'failed');smtp.assert_not_called()
 def test_uncertain_never_retried(self):
  with patch.dict(os.environ,{'MAIL_USERNAME':'danny@example.com','MAIL_PASSWORD':'fake'}),patch.object(m,'api',return_value=[self.row]),patch.object(m,'project_allowed',return_value=True),patch.object(m,'query',return_value=[]),patch.object(m,'update') as update,patch.object(m.smtplib,'SMTP_SSL',side_effect=TimeoutError):
   m.send(self.row);self.assertEqual(update.call_args.args[1],'uncertain')
 def test_accept_no_resend_on_append_failure(self):
  with patch.dict(os.environ,{'MAIL_USERNAME':'danny@example.com','MAIL_PASSWORD':'fake'}),patch.object(m,'api',return_value=[self.row]),patch.object(m,'project_allowed',return_value=True),patch.object(m,'query',return_value=[]),patch.object(m,'update') as update,patch.object(m.smtplib,'SMTP_SSL') as smtp,patch.object(m.imaplib,'IMAP4_SSL',side_effect=TimeoutError):
   m.send(self.row);smtp.return_value.__enter__.return_value.send_message.assert_called_once();self.assertEqual(update.call_args.args[1],'accepted');self.assertIn('Sent-folder copy failed',update.call_args.args[2])
 def test_no_send_after_sync_failure(self):
  with patch.dict(os.environ,{'STUDIO_MAIL_ENABLED':'true','SUPABASE_URL':'https://test.supabase.co','SUPABASE_SERVICE_KEY':'fake','MAIL_OWNER_ID':'owner','MAIL_USERNAME':'danny@example.com','MAIL_PASSWORD':'fake'}),patch.object(m,'query',return_value=[{}]),patch.object(m,'sync_replies',side_effect=RuntimeError),patch.object(m,'send') as send:
   with self.assertRaises(RuntimeError):m.main()
   send.assert_not_called()
 def test_saved_content_rechecked(self):
  p={'id':'p','stage':'Demo ready','email':self.row['recipient'],'outreachDraft':'Subject: Hello\n\nText','checks':dict.fromkeys(['demo','facts','contact','eligibility','email'],True)}
  with patch.object(m,'query',return_value=[{'projects':[p]}]):
   self.assertTrue(m.project_allowed(self.row));p['outreachDraft']='Changed';self.assertFalse(m.project_allowed(self.row))
 def test_reply_plain_only(self):
  msg=EmailMessage();msg.set_content('<script>no rendering</script>','html');self.assertIn('No plain-text',m.plain(msg))
if __name__=='__main__':unittest.main()
