#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
import string
from afm import app, db, login_manager

try:
    from flask.ext.mongokit import Document
except ImportError:
    from mongokit import Document
from hashlib import md5
import random
from datetime import datetime
import pymongo.errors
from flask_login import AnonymousUserMixin
from afm.helpers import naturalday


def md5hash(data):
    hashed = md5()
    hashed.update(data)
    return hashed.hexdigest()


def get_ts():
    return int(time.time())


def comma_fields(fields_str):
    fields = fields_str.split(',')
    fields = map(string.strip, fields)
    return fields


def list_public(objects, fields=None):
    return [item.get_public(fields) for item in objects]


def create_obj(klass, data):
    obj = klass()
    obj.update(data)
    obj.save()
    return obj


def soft_delete(coll, obj_id):
    db[coll].update({'id': obj_id}, {'$set': {'deleted_at': get_ts()}})


def restore_obj(coll, obj_id):
    db[coll].update({'id': obj_id}, {'$set': {'deleted_at': 0}})


def get_next_id(ns):
    ret = db.object_ids.find_and_modify(query={'_id': ns}, update={'$inc': {'next': 1}}, new=True, upsert=True)
    return int(ret['next'])


class BaseDocument(Document):
    use_dot_notation = True
    use_autoinc_id = False
    json_schema = {}
    public = ['id']

    def save(self, *args, **kwargs):
        # автоинкремент числового идентификатора
        if self.use_autoinc_id:
            self['_id'] = get_next_id(self.collection.name)

        spec = self.structure.get('id')
        if spec is int and not self['id']:
            self['id'] = get_next_id(self.collection.name)

        return super(BaseDocument, self).save(*args, **kwargs)

    def get_public(self, fields=None):
        if fields is None:
            fields = self.public
        elif isinstance(fields, basestring):
            fields = fields.split(',')
        fields = set(fields) & set(self.structure.keys())
        return dict((field, self.get(field)) for field in fields)

    def find_public(self, where=None, **kwargs):
        if where is None:
            where = {}
        where['deleted_at'] = 0
        return self.find(where, **kwargs)

    def as_dict(self):
        return dict((name, self.get(name)) for name, val in self.structure.iteritems())

    def get_json_schema(self, keys=None):
        if keys is None:
            return self.json_schema
        return dict((key, self.json_schema.get(key)) for key in keys if key in self.json_schema)


class AnonymousUser(AnonymousUserMixin):
    def get_public(self, *args):
        return None

    def can(self, permission):
        return False

login_manager.anonymous_user = AnonymousUser


@db.register
class User(BaseDocument):
    __collection__ = 'users'

    structure = {
        'id': int,
        'name': unicode,
        'sex': unicode,
        'login': unicode,
        'email': unicode,
        'password': unicode,
        'new_password': unicode,
        'avatar_url': unicode,
        'connect': dict,
        'is_active': bool,
        'is_admin': bool,
        'settings': dict,
    }

    indexes = [{'fields': 'id', 'unique': True}]

    default_values = {
        'login': u'',
        'sex': u'',
        'avatar_url': u'',
        'email': u'',
        'connect': {},
        'is_active': True,
        'is_admin': False,
    }

    admin_perms = ['blog.admin']

    def can(self, permission):
        if self.is_admin() and permission in self.admin_perms:
            return True
        return False

    def check_password(self, raw_password):
        if not self['password']:
            return False
        hashed = self._password_hash(raw_password)
        return hashed == self['password']

    def set_password(self, raw_password):
        password = self._password_hash(raw_password)
        self.password = password.decode('utf-8')

    def _password_hash(self, raw_password):
        return md5hash(app.secret_key + raw_password)

    def is_admin(self):
        return self['is_admin']

    def generate_new_password(self, length=8):
        chars = string.letters + string.digits
        password = [random.choice(chars) for i in xrange(length)]
        password = string.join(password, '')
        self['new_password'] = self._password_hash(password).decode('utf-8')
        self.save()
        return password, self.new_password_token()

    def new_password_token(self):
        if not self['new_password']:
            return False
            # double hashing
        return self._password_hash(self['new_password'])

    def confirm_new_password(self, password_or_token):
        if not self['new_password']:
            return False
        password_match = (self['new_password'] == self._password_hash(password_or_token))
        token_match = (password_or_token == self.new_password_token())
        if password_match or token_match:
            self['password'] = self['new_password']
            self['new_password'] = u''
            self.save()
            return True
        return False

    def find_login(self, login):
        login = login.lower()
        key = 'email' if '@' in login else 'login'
        return self.find_one({key: login})

    @property
    def gravatar_hash(self):
        return md5hash(self['email'].lower())

    def is_authenticated(self):
        return True

    def is_active(self):
        return self['is_active']

    def is_anonymous(self):
        return False

    def get_id(self):
        return self['id']


@db.register
class Track(BaseDocument):
    __collection__ = 'tracks'

    structure = {
        'id': int,
        'title': unicode,
        'rawtitle': unicode,
        'artist': unicode,
        'name': unicode,
        'image_url': unicode,
        'tags': [unicode],
        'hash': int,
        'created_at': datetime,
    }

    indexes = [
        {'fields': 'id', 'unique': True},
        {'fields': ['hash', 'rawtitle'], 'unique': True},
    ]

    default_values = {
        'created_at': datetime.now,
    }

    def get_public(self, fields=None):
        return {
            'id': self['id'],
            'title': self['title'],
            #'artist': self['artist'],
            #'name': self['name']
        }


@db.register
class FeedbackMessage(BaseDocument):
    __collection__ = 'feedback_messages'

    structure = {
        'id': int,
        'text': unicode,
        'email': unicode,
        'remote_addr': unicode,
        'created_at': datetime
    }

    default_values = {
        'created_at': datetime.now
    }


@db.register
class RadioGenre(BaseDocument):
    __collection__ = 'radio_genre'
    structure = {
        'id': int,
        'title': unicode,
        'is_public': bool
    }

    default_values = {
        'is_public': False,
    }

    public = ['id', 'title']

    def find_public(self, where=None, **kwargs):
        if where is None:
            where = {}
        where['is_public'] = True
        return self.find(where, **kwargs)


@db.register
class RadioGroup(BaseDocument):
    __collection__ = 'radio_group'

    structure = {
        'id': int,
        'title': unicode,
        'slug': unicode,
        'owners': [int],
        'created_at': int,
        'deleted_at': int,
    }

    default_values = {
        'slug': u'',
        'owners': [],
        'created_at': get_ts,
        'deleted_at': 0,
    }

    public = ['id', 'title']


@db.register
class Radio(BaseDocument):
    __collection__ = 'radio'

    structure = {
        'id': int,
        'title': unicode,
        'slug': unicode,
        'description': unicode,
        'city': int,
        'website': unicode,
        'genre': [int],
        'group': dict,
        'owner_id': int,
        'is_channel': bool,
        'is_public': bool,
        'air_record': bool,
        'tag': dict,
        'air': dict,
        'stream_type': list,
        'check_at': int,
        'created_at': int,
        'deleted_at': int,
        'updated_at': int,
    }

    default_values = {
        'slug': u'',
        'description': u'',
        'city': 0,
        'website': u'',
        'genre': [],
        'is_channel': False,
        'is_public': False,
        'check_at': 0,
        'air': {
            'track': False,
            'min': 5
        },
        'created_at': get_ts,
        'deleted_at': 0,
        'updated_at': 0,
    }

    json_schema = {
        'title': {
            'type': 'string',
            'maxLength': 256,
        },
        'description': {
            'type': 'string',
            'blank': True,
            'required': False,
            'maxLength': 512,
        },
        'website': {
            'type': 'string',
            'blank': True,
            'required': False,
            'maxLength': 512,
        },
        'city': {
            'type': 'int',
            'blank': True,
            'required': False,
            'maxLength': 64,
        },
    }

    public = ['id', 'title', 'description']

    def modify(self, data):
        # TODO: пушить обновленные данные в поиск
        # TODO: переместить в BaseDocument ?
        data.pop('id', False)
        data['updated_at'] = get_ts()
        self.collection.update({'id': self['id']}, {'$set': data})


@db.register
class Playlist(BaseDocument):
    __collection__ = 'playlist'

    structure = {
        'id': int,
        'radio_id': int,
        'url': unicode,
        'streams': [unicode],
        'created_at': int,
        'updated_at': int,
        'deleted_at': int,
    }

    default_values = {
        'streams': [],
        'created_at': get_ts,
        'updated_at': 0,
        'deleted_at': 0,
    }

    public = ['id', 'url', 'streams']


@db.register
class Stream(BaseDocument):
    # TODO: maybe rename streams -> stream ??
    __collection__ = 'streams'

    structure = {
        'id': int,
        'url': unicode,
        'radio_id': int,
        'playlist_id': int,
        # основные свойства
        'bitrate': int,
        'content_type': unicode,
        'is_shoutcast': bool,
        'is_online': bool,
        'check': dict,
        'meta': dict,
        'created_at': int,
        'checked_at': int,
        'deleted_at': int,
    }

    indexes = [
        {'fields': ['radio_id', 'url'], 'unique': True}
    ]

    default_values = {
        'playlist_id': 0,
        'bitrate': 0,
        'content_type': u'',
        'is_shoutcast': False,
        'is_online': True,
        'check': {},
        'meta': {},
        'created_at': get_ts,
        'checked_at': 0,
        'deleted_at': 0,
    }

    public = ['id', 'bitrate', 'listen_url', 'content_type']

    @property
    def listen_url(self):
        # если поток вешается через шауткаст,
        # то для веб-плееров добавляем ";"
        # иначе показывается страница статистики
        if self.is_shoutcast:
            return u'{};'.format(self.url)
        return self.url

    def get_public(self, fields=None):
        return {
            'id': self['id'],
            'bitrate': self['bitrate'],
            'listen_url': self.listen_url,
            'content_type': self['content_type']
        }

    @classmethod
    def bulk_add(cls, radio_id, urls, playlist_id=0):
        # добавление потоков
        # игнорируем, если поток уде был добавлен из другого плейлиста
        for stream_url in urls:
            try:
                create_obj(db.Stream, {'url': stream_url, 'playlist_id': playlist_id, 'radio_id': radio_id})
            except pymongo.errors.DuplicateKeyError:
                pass


@db.register
class Air(BaseDocument):
    __collection__ = 'air'

    structure = {
        'id': int,
        'rid': int,
        'sid': int,
        'title': unicode,
        'ts': int,
    }

    @property
    def time(self):
        return datetime.fromtimestamp(self.ts)

    @property
    def natural_day(self):
        return naturalday(self.time, ts_format='%Y.%m.%d')


@db.register
class Page(BaseDocument):
    __collection__ = 'pages'

    structure = {
        'id': int,
        'path': unicode,
        'title': unicode,
        'content': unicode,
        'created_at': int,
        'updated_at': int,
        'deleted_at': int,
    }

    default_values = {
        'created_at': get_ts,
        'updated_at': 0,
        'deleted_at': 0
    }


if __name__ == '__main__':
    import unittest

    class RadioTest(unittest.TestCase):
        pass

    unittest.main()