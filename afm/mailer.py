from boto.ses.connection import SESConnection

class AmazonMailer(SESConnection):
    def __init__(self, app, *args, **kwargs):
        super(AmazonMailer, self).__init__(
            aws_access_key_id=app.config['AMAZON_SES_ACCESS_KEY'],
            aws_secret_access_key=app.config['AMAZON_SES_SECRET_KEY'],
            *args, **kwargs
        )

