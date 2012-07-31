from fabric.api import local, lcd

def compass_watch():
    local('compass watch afm/static')

def celery():
    local('celery -A afm.celery worker -l info')

def make_player():
    with lcd('player'):
        local('as3compile --flashversion 10 --output ../afm/static/swf/player.swf player.as')