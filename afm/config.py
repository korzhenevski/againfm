#!/usr/bin/env python
# -*- coding: utf-8 -*-

DEBUG = True
PRODUCTION = False
SECRET_KEY = '8b7707cbf3ac84b95361319960654c77'
SEND_MAIL = True

# максимальный размер загружаемого файла
MAX_CONTENT_LENGTH = 1024 * 1024

AMAZON_SES_ACCESS_KEY = 'AKIAI35JFXNA25HR2T6A'
AMAZON_SES_SECRET_KEY = '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'

DEFAULT_MAIL_SENDER = 'Again.FM <mail@again.fm>'
DEFAULT_MAIL_SUBJECT = 'Again.FM'
ADMIN_EMAIL = 'yura.nevsky@gmail.com'

MONGODB_HOST = 'localhost'
MONGODB_PORT = 27017
MONGODB_DATABASE = 'againfm'

REDIS = {
    'host': 'localhost',
    'port': 6379,
    'db': 0
}

CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_BACKEND = 'mongodb'
CELERY_MONGODB_BACKEND_SETTINGS = {
    'host': MONGODB_HOST,
    'port': MONGODB_PORT,
    'database': MONGODB_DATABASE,
}

BROKER_URL = 'mongodb://%(host)s:%(port)d/%(database)s' % CELERY_MONGODB_BACKEND_SETTINGS

# адрес инбокса для почтового домена
EMAIL_PROVIDERS = {
    'mail.yandex.ru': ['ya.ru', 'yandex.ru'],
    'mail.rambler.ru': ['rambler.ru', 'lenta.ru', 'myrambler.ru', 'autorambler.ru', 'ro.ru', 'r0.ru'],
    'mail.google.com': ['gmail.com', 'googlemail.com'],
    'mail.again.fm': ['again.fm', 'afm.fm'],
    'e.mail.ru': ['mail.ru', 'inbox.ru', 'bk.ru', 'list.ru']
}

VK = {
    'app_id': '3183069',
    'secret': 'YYhwf0e5rqyNli117cL2',
    'authorize_url': 'https://oauth.vk.com/authorize',
    'access_token_url': 'https://oauth.vk.com/access_token',
}

UPLOADS_DEFAULT_DEST = '/tmp'

# whoosh search index
RADIO_INDEX = '/tmp/againfm_whoosh'

# production error log
ERROR_LOG = '/tmp/againfm_error.log'

SEARCH_LOG = True