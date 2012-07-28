from fabric.api import cd, local

def compass_watch():
    local('compass watch afm/static')

def celery():
    local('celery -A afm.celery worker -l info')

def make_player():
    local('cd player; as3compile --flashversion 10 --output ../afm/static/swf/player.swf player.as')