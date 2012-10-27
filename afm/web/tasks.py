from afm import celery
from afm import mailer
from afm import app

@celery.task
def send_mail(email, body, subject=None):
    if subject is None:
        subject = app.config['DEFAULT_MAIL_SUBJECT']
    return mailer.send_email(
        source=app.config['DEFAULT_MAIL_SENDER'],
        subject=subject, body=body, to_addresses=[email], format='html',
    )