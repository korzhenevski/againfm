#!/usr/bin/env python
# -*- coding: utf-8 -*-

import time
import string
from . import app, db

try:
    from flask.ext.mongokit import Document
except ImportError:
    from mongokit import Document
from hashlib import md5
from random import choice
from datetime import datetime

def md5hash(data):
    hashed = md5()
    hashed.update(data)
    return hashed.hexdigest()

def get_ts():
    return int(time.time())

class BaseDocument(Document):
    use_dot_notation = True

    def save(self, *args, **kwargs):
        # автоинкремент числового идентификатора
        spec = self.structure.get('id')
        if spec is int and not self['id']:
            self['id'] = self.db.object_ids.find_and_modify(
                query={'_id': self.collection.name},
                update={'$inc': {'next': 1}},
                new=True, upsert=True)['next']
        return super(BaseDocument, self).save(*args, **kwargs)

class UserFavoritesCache(object):
    def __init__(self, user_id, redis=None):
        if redis is None:
            from . import redis as global_redis
            self.redis = global_redis
        else:
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
        'station': {
            'id': int,
            'title': unicode,
        },
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
            'station': filter_keys(station, cls.structure['station']),
            'user_id': user_id,
        })

    @classmethod
    def remove(cls, track_id, station_id, user_id):
        cls.remove({'track.id': track_id, 'station.id': station_id, 'user_id': user_id})

    def get_public(self):
        fields = self.structure.keys()
        data = dict([(k, v) for k, v in self.iteritems() if k in fields])
        ts = datetime.utcfromtimestamp(data['created_at'])
        data['time'] = ts.strftime("%H:%M")
        data['favorite'] = bool(data['favorite'] % 2)
        return data

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
        'settings': {
            'throttle_traffic': bool,
            'limit_night_volume': bool,
            'fading_sound': bool,
            'spectrum': bool
        }
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
        'settings.throttle_traffic': False,
        'settings.fading_sound': True,
        'settings.limit_night_volume': True,
        'settings.spectrum': True,
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

    def get_public(self):
        return {
            'id': self['id'],
            'email': self['email'],
            'name': self['name'],
            'sex': self['sex'],
            'avatar_url': self['avatar_url'],
            'gravatar_hash': self.gravatar_hash,
            'settings': self['settings']
        }

    def generate_new_password(self, length=8):
        chars = string.letters + string.digits
        password = [choice(chars) for i in xrange(length)]
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
        key = 'email' if '@' in login else 'login'
        where = {}
        where[key] = login
        return self.find_one(where)

    def is_authenticated(self):
        return True

    def is_active(self):
        return self['is_active']

    def is_anonymous(self):
        return False

    def get_id(self):
        return self['id']

    @property
    def gravatar_hash(self):
        return md5hash(self['email'].lower())


@db.register
class Station(BaseDocument):
    __collection__ = 'stations'
    # Константы статуса
    # потоки не отвечают более шести часов
    OFFLINE = 0
    # есть хоть один живой поток
    ACTIVE = 1
    # потоки не отвечают менее шести часов
    # радио отмечено, есть возможность добавить в избранное
    ERROR = 2

    structure = {
        'id': int,
        'tags': [unicode],
        'title': unicode,
        'status': int,
        'website': unicode,
        'playlist': [unicode],
        'playlist_updated_at': int,
        'itunes': dict,
        'online_streams': [int],
    }

    indexes = [
        {'fields': 'id', 'unique': True},
        {'fields': 'tags'},
        {'fields': 'status'},
    ]

    default_values = {
        'status': 0,
        'playlist_updated_at': 0,
    }

    def get_public(self):
        return {
            'id': self['id'],
            'title': self['title'],
            'is_online': self['status'] != self.OFFLINE
        }

    def find_public(self, query=None):
        if query is None:
            query = {}
        query['online_streams'] = {'$not': {'$size': 0}, '$exists': True}
        query['status'] = {'$ne': self.OFFLINE}
        return self.find(query)

    @staticmethod
    def public_list(models):
        return [(model['id'], model['title']) for model in models]


@db.register
class Stream(BaseDocument):
    __collection__ = 'streams'

    structure = {
        'id': int,
        'url': unicode,
        'station_id': int,
        'bitrate': int,
        'perform_check': bool,
        'is_shoutcast': bool,
        'is_online': bool,
        'content_type': unicode,
        'check_error': unicode,
        'checked_at': int,
        'playlist_url': unicode,
        'created_at': datetime,
        'error_at': int,
    }

    indexes = [
        {'fields': 'id', 'unique': True},
        {'fields': 'url', 'unique': True},
        {'fields': ['checked_at', 'perform_check']},
        {'fields': ['station_id', 'is_online']}
    ]

    default_values = {
        'created_at': datetime.now,
        'bitrate': 0,
        'checked_at': 0,
        'error_at': 0,
        'perform_check': True,
        'is_online': True,
        'is_shoutcast': False,
    }

    def get_web_url(self):
        # если поток вешается через шауткаст,
        # то для веб-плееров добавляем ";"
        # иначе показывается страница статистики
        if self.is_shoutcast:
            return self.url + u';'
        return self.url

    def get_public(self):
        return {
            'id': self['id'],
            'url': self.get_web_url(),
            'bitrate': self['bitrate'],
        }

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

@db.register
class StationTag(BaseDocument):
    __collection__ = 'stations_tags'

    structure = {
        'id': int,
        'title': unicode,
        'tags': [unicode],
        'is_visible': bool
    }
    i18n = ['title']
    default_values = {
        'is_visible': True,
    }

    indexes = [{'fields': 'id', 'unique': True}]

    def get_public(self):
        return {
            'id': self['id'],
            'title': self['tag'],
        }

@db.register
class Genre(BaseDocument):
    __collection__ = 'genres'
    structure = {
        'id': unicode,
        'title': unicode,
        'tags': [unicode]
    }

    def get_public(self):
        return {
            'id': self.id,
            'title': self.get_i18n('title')
        }

    def get_i18n(self, name):
        val = getattr(self, name)
        return val.get(self._current_lang, val.get(self._fallback_lang))

    @staticmethod
    def public_list(lang):
        genres = []
        for genre in db.Genre.find():
            genre.set_lang(lang)
            genres.append(genre.get_public())
        return genres

@db.register
class OnairHistory(BaseDocument):
    __collection__ = 'onair_history'

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
