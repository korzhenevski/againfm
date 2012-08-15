DEBUG = True

ASSETS_DEBUG = DEBUG
SECRET_KEY = 'secret_key'
CSRF_ENABLED = False

BABEL_DEFAULT_TIMEZONE = 'Europe/Moscow'

AMAZON_SES_ACCESS_KEY = 'AKIAJLSUMU4WCVLPMXAQ'
AMAZON_SES_SECRET_KEY = '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'
DEFAULT_MAIL_SENDER = 'mail@again.fm'

MONGODB_HOST = 'localhost'
MONGODB_PORT = 27017
MONGODB_DATABASE = 'againfm'

CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_BACKEND = 'mongodb'
CELERY_MONGODB_BACKEND_SETTINGS = {
    'host': MONGODB_HOST,
    'port': MONGODB_PORT,
    'database': MONGODB_DATABASE,
}

BROKER_URL = 'mongodb://%(host)s:%(port)d/%(database)s' % CELERY_MONGODB_BACKEND_SETTINGS

EMAIL_PROVIDERS = {
    'mail.yandex.ru': ['ya.ru','yandex.ru'],
    'mail.rambler.ru': ['rambler.ru', 'lenta.ru', 'myrambler.ru', 'autorambler.ru', 'ro.ru', 'r0.ru'],
    'mail.google.com': ['gmail.com', 'googlemail.com'],
    'mail.again.fm': ['again.fm', 'afm.fm']
}