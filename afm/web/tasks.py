#!/usr/bin/env python
# -*- coding: utf-8 -*-
from afm import app, celery, mailer

@celery.task
def send_mail(email, body, subject=None):
    if subject is None:
        subject = app.config['DEFAULT_MAIL_SUBJECT']
    result = mailer.send_email(
        source=app.config['DEFAULT_MAIL_SENDER'],
        subject=subject, body=body, to_addresses=[email], format='html')
    return result