#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
import string
from afm import app, db, search, login_manager
from afm import redis

try:
    from flask.ext.mongokit import Document
except ImportError:
    from mongokit import Document
from hashlib import md5
import random
from datetime import datetime
import pymongo.errors
from flask_login import AnonymousUser
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


class BaseDocument(Document):
    use_dot_notation = True
    use_autoinc_id = False
    json_schema = {}
    public = ['id']

    def save(self, *args, **kwargs):
        # автоинкремент числового идентификатора
        if self.use_autoinc_id:
            self['_id'] = self.get_next_id(self.collection.name)

        spec = self.structure.get('id')
        if spec is int and not self['id']:
            self['id'] = self.get_next_id(self.collection.name)

        return super(BaseDocument, self).save(*args, **kwargs)

    def get_next_id(self, ns):
        ret = self.db.object_ids.find_and_modify(query={'_id': ns}, update={'$inc': {'next': 1}}, new=True, upsert=True)
        return ret['next']

    @classmethod
    def soft_delete(cls, **where):
        if not cls.__collection__ or where:
            return
        db[cls.__collection__].update(where, {'$set': {'deleted_at': get_ts()}})

    @classmethod
    def restore(cls, **where):
        if not cls.__collection__ or where:
            return
        db[cls.__collection__].update(where, {'$set': {'deleted_at': 0}})

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


class UserFavoritesCache(object):
    def __init__(self, user_id):
        self.redis = redis
        self.user_id = user_id

    def add(self, object_type, object_id):
        self.redis.zadd(self.object_key(object_type), object_id, get_ts())

    def exists(self, object_type, object_id):
        score = self.redis.zscore(self.object_key(object_type), object_id)
        return bool(score)

    def remove(self, object_type, object_id):
        self.redis.zrem(self.object_key(object_type), object_id)

    def toggle(self, object_type, object_id, state=None):
        if state is None:
            state = not self.exists(object_type, object_id)

        if state:
            self.add(object_type, object_id)
        else:
            self.remove(object_type, object_id)
        return state

    def object_key(self, object_type):
        return 'favorite_user_{}:{}'.format(object_type, self.user_id)


class AbstractFavorite(BaseDocument):
    @staticmethod
    def decorate(obj):
        obj['favorite'] = bool(obj['favorite'] % 2)
        return obj

    @classmethod
    def toggle_favorite(cls, query, update=None):
        collection = db[cls.__collection__]
        if update is None:
            update = {}
        update.update({'$inc': {'favorite': 1}})
        row = collection.find_and_modify(query, update, new=True, upsert=True)
        # добавляем время создания
        # в upsert нельзя, иначе ломается его логика
        if 'created_at' not in row:
            row = collection.find_and_modify(query, {'$set': {'created_at': get_ts()}}, new=True)
            # изменяем инкрементом, значение получаем остатком от деления
        return cls.decorate(row)


@db.register
class FavoriteTrack(AbstractFavorite):
    __collection__ = 'favorite_tracks'

    structure = {
        'user_id': int,
        'track': {
            'id': int,
            'title': unicode,
            'artist': unicode,
            'name': unicode
        },
        #'station': {
        #    'id': int,
        #   'title': unicode,
        #},
        'favorite': bool,
        'created_at': int
    }
    indexes = [{'fields': ['track.id', 'user_id'], 'unique': True}]

    @classmethod
    def toggle(cls, track, station, user_id):
        # копируем только нужные ключи
        filter_keys = lambda source, keys: dict((k, v) for k, v in source.iteritems() if k in keys)
        return cls.toggle_favorite({
            'track': filter_keys(track, cls.structure['track']),
            #'station': filter_keys(station, cls.structure['station']),
            'user_id': user_id,
        })

    @classmethod
    def remove(cls, track_id, station_id, user_id):
        cls.remove({'track.id': track_id, 'station.id': station_id, 'user_id': user_id})

    def get_public(self):
        return {
            'id': self['track']['id'],
            'title': self['track']['title']
        }


# TODO: сюда хорошо добавить dbref на station
@db.register
class FavoriteStation(AbstractFavorite):
    __collection__ = 'favorite_stations'
    structure = {
        'user_id': int,
        'station_id': int,
        'favorite': int,
        'created_at': int,
    }
    indexes = [{'fields': ['user_id', 'station_id'], 'unique': True}]

    @classmethod
    def toggle(cls, station_id, user_id):
        return cls.toggle_favorite({
            'user_id': user_id,
            'station_id': station_id
        })

    @classmethod
    def remove(cls, station_id, user_id):
        db[cls.__collection__].remove({'user_id': user_id, 'station_id': station_id})


class AnonUser(AnonymousUser):
    def get_public(self, *args):
        return None


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
        'settings': dict
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

    def get_public(self):
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
        # короткое URL-имя
        'slug': unicode,
        'description': unicode,
        # страна, город
        'location': unicode,
        'website': unicode,
        'genres': [int],
        'group': dict,
        'owner_id': int,
        'is_channel': bool,
        'is_public': bool,
        'air': {
            'track': bool,
            'record': bool,
        },
        'stat': dict,
        'tag': dict,
        'created_at': int,
        'deleted_at': int,
    }

    default_values = {
        'slug': u'',
        'description': u'',
        'location': u'',
        'website': u'',
        'genres': [],
        'is_channel': False,
        'is_public': False,
        'created_at': get_ts,
        'deleted_at': 0,
        'air': {
            'track': False,
            'record': False,
        }
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
        'location': {
            'type': 'string',
            'blank': True,
            'required': False,
            'maxLength': 64,
        },
    }

    public = ['id', 'title', 'description', 'location']

    def get_related(self, limit=5):
        from random import shuffle

        if not self['genres']:
            return []
        where = {'id': {'$ne': self['id']}, 'genres': self['genres']}
        results = list(db.Radio.find(where, sort=[('title', 1)], limit=limit * 3))
        shuffle(results)
        return results[:limit]

    def get_genres(self):
        if not self['genres']:
            return []
        return list(db.RadioGenre.find({'id': self['genres']}))

    def get_streams(self):
        return list(stream.get_public() for stream in db.Stream.find({'radio_id': self['id'], 'deleted_at': 0}))

    def get_playlists(self):
        return list(playlist.get_public() for playlist in db.Playlist.find({'radio_id': self['id'], 'deleted_at': 0}))

    def push_to_search(self):
        return search.index(self.as_dict(), 'radio', self.id)


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

    @property
    def listen_url(self):
        # если поток вешается через шауткаст,
        # то для веб-плееров добавляем ";"
        # иначе показывается страница статистики
        if self.is_shoutcast:
            return u'{};'.format(self.url)
        return self.url

    def get_public(self):
        return {
            'id': self['id'],
            'bitrate': self['bitrate'],
            'listen_url': self.listen_url,
            'content_type': self['content_type']
        }

    @classmethod
    def bulk_add(cls, radio_id, urls, playlist_id=0):
        # добавление потоков
        for stream_url in urls:
            stream = db.Stream()
            stream.update({
                'url': stream_url,
                'playlist_id': playlist_id,
                'radio_id': radio_id,
            })

            try:
                stream.save()
            except pymongo.errors.DuplicateKeyError:
                # игнорируем, если поток уде был добавлен из другого плейлиста
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

login_manager.anonymous_user = AnonUser

if __name__ == '__main__':
    import unittest

    class RadioTest(unittest.TestCase):
        pass

    unittest.main()