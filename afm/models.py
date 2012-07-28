# -*- coding: utf-8 -*-

import string
from . import app, login_manager, db
try:
    from flask.ext.mongokit import Document
except ImportError:
    from mongokit import Document
from hashlib import md5
from bson.objectid import ObjectId
from random import choice
from datetime import datetime

def md5hash(data):
    hashed = md5()
    hashed.update(data)
    return hashed.hexdigest()

@login_manager.user_loader
def load_user(user_id):
    user = db.User.get_from_id(ObjectId(user_id))
    return user

class BaseDocument(Document):
    use_dot_notation = True

@db.register
class User(BaseDocument):
    __collection__ = 'users'

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

@db.register
class Station(BaseDocument):
    __collection__ = 'stations'
    structure = {
        'title': unicode,
        'website': unicode
    }

    def get_public_data(self):
        return {
            'id': unicode(self._id),
            'title': self.title
        }

@db.register
class Stream(BaseDocument):
    __collection__ = 'streams'
    use_autorefs = True

    structure = {
        'station': Station,
        'url': unicode,
        'bitrate': int
    }

@db.register
class Category(BaseDocument):
    __collection__ = 'categories'
    use_autorefs = True

    structure = {
        'title': unicode,
        'stations': [Station],
        'is_public': bool
    }

    def get_public_data(self):
        return {
            'id': unicode(self._id),
            'title': self.title
        }

@db.register
class Track(BaseDocument):
    __collection__ = 'tracks'

    structure = {
        'artist': unicode,
        'name': unicode,
        'title': unicode,
        'cover_url': unicode,
        'tags': [unicode],
        'mbid': unicode,
        'created_at': datetime,
    }

    default_values = {
        'created_at': datetime.utcnow,
    }

@db.register
class StreamTitle(BaseDocument):
    __collection__ = 'stream_titles'
    use_autorefs = True

    structure = {
        # сырой заголовок из потока
        'title': unicode,
        # нормализованный трек из внешней базы (last.fm, etc.)
        'track': {
            'id': ObjectId,
            'title': unicode,
            'cover_url': unicode,
        },
        'stream_id': ObjectId,
        'created_at': datetime,
    }

    default_values = {
        'created_at': datetime.utcnow,
    }

@db.register
class Favorite(BaseDocument):
    __collection__ = 'favorites'
    use_autorefs = True

    structure = {
        'station': Station,
        'stream_title': StreamTitle,
        'user_id': ObjectId,
        'created_at': datetime,
        # mongodb hack
        # вместо bool, мы увеличиваем значение
        # и активными считаются все active % 2 == 0
        'active': int
    }

    default_values = {
        'created_at': datetime.utcnow,
        'active': 0
    }

    @property
    def is_active(self):
        return not self.active % 2