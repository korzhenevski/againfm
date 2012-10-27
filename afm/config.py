DEBUG = True

TESTING = DEBUG
ASSETS_DEBUG = DEBUG
SECRET_KEY = 'secret_key'
CSRF_ENABLED = False

LANG = 'ru'

AMAZON_SES_ACCESS_KEY = 'AKIAJLSUMU4WCVLPMXAQ'
AMAZON_SES_SECRET_KEY = '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'
DEFAULT_MAIL_SENDER = 'mail@again.fm'

MONGODB_HOST = 'localhost'
MONGODB_PORT = 27017
MONGODB_DATABASE = 'againfm'

# params passed to Redis constructor
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

EMAIL_PROVIDERS = {
    'mail.yandex.ru': ['ya.ru','yandex.ru'],
    'mail.rambler.ru': ['rambler.ru', 'lenta.ru', 'myrambler.ru', 'autorambler.ru', 'ro.ru', 'r0.ru'],
    'mail.google.com': ['gmail.com', 'googlemail.com'],
    'mail.again.fm': ['again.fm', 'afm.fm']
}

COMET_SERVER = 'http://comet.againfm.local/'
SEARCH_BACKEND_URL = 'http://127.0.0.1:9200/againfm_stations/_search'

VK = {
    'app_id': '3183069',
    'secret': 'YYhwf0e5rqyNli117cL2',
    'authorize_url': 'https://oauth.vk.com/authorize',
    'access_token_url': 'https://oauth.vk.com/access_token',
}

SENTRY_DSN = 'https://b6ea77c550514e9bb69cd12d78ec985d:08b229e4517f4d04ac55a684db42d852@app.getsentry.com/741'