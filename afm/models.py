import string
from . import app, login_manager, db
from flask.ext.mongokit import Document
from hashlib import md5
#from mongokit import Document
from bson.objectid import ObjectId
from random import choice

def md5hash(data):
    hashed = md5()
    hashed.update(data)
    return hashed.hexdigest()

@login_manager.user_loader
def load_user(user_id):
    user = db.User.get_from_id(ObjectId(user_id))
    return user

@db.register
class User(Document):
    __collection__ = 'users'
    use_dot_notation = True

    structure = {
        'name': unicode,
        'login': unicode,
        'email': unicode,
        'password': unicode,
        'new_password': unicode,
        'is_active': bool,
        'settings': {
            'throttle_traffic': bool,
            'limit_night_volume': bool,
            'fading_sound': bool
        }
    }

    default_values = {
        'login': u'',
        'is_active': True,
        'settings.throttle_traffic': False,
        'settings.fading_sound': True,
        'settings.limit_night_volume': True
    }

    def check_password(self, raw_password):
        if not self.password:
            return False
        hashed = self._password_hash(raw_password)
        return hashed == self.password

    def set_password(self, raw_password):
        password = self._password_hash(raw_password)
        self.password = password.decode('utf-8')

    def _password_hash(self, raw_password):
        return md5hash(app.secret_key + raw_password)

    def is_authenticated(self):
        return True

    def is_active(self):
        return self['is_active']

    def is_anonymous(self):
        return False

    def get_id(self):
        return unicode(self._id)

    def get_public_data(self):
        return {
            'id': unicode(self._id),
            'email': self.email,
            'name': self.name,
            'gravatar_hash': self.gravatar_hash
        }

    @property
    def gravatar_hash(self):
        return md5hash(self.email.lower())

    def generate_new_password(self, length=8):
        chars = string.letters + string.digits
        password = [choice(chars) for i in xrange(length)]
        password = string.join(password, '')
        self.new_password = self._password_hash(password).decode('utf-8')
        self.save()
        return password, self.new_password_token()

    def new_password_token(self):
        if not self.new_password:
            return False
        # double hashing
        return self._password_hash(self.new_password)

    def confirm_new_password(self, password_or_token):
        if not self.new_password:
            return False
        password_match = (self.new_password == self._password_hash(password_or_token))
        token_match = (password_or_token == self.new_password_token())
        if password_match or token_match:
            self.password = self.new_password
            self.new_password = u''
            self.save()
            return True
        return False

"""
class Station(Document):
    __collection__ = 'stations'
    use_dot_notation = True

    structure = {
        'title': unicode,
        'website': unicode,
        'genres': [{}]
    }

class Favorite(Document):
    __collection__ = 'favorites'
    use_dot_notation = True
    use_autorefs = True

    structure = {
        'user': User,
        'station': unicode,
    }
"""