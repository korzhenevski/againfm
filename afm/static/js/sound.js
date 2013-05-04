angular.module('afm.sound', ['afm.base'])

.factory('player', function($rootScope, storage, audioEngine, flash){
    var obj = {
        url: null,
        player: null,
        muted: false,
        playing: false,
        volume: 0.6,
        defaultVolume: 0.6,

        play: function(url) {
            if (url) {
                this.url = url;
            }

            if (this.player && this.url) {
                this.player.playStream(this.url + '&p=' + this.getParams());
                this.playing = true;
            }
        },

        getParams: function() {
            var params = [];
            if (this.player && this.player.canPlayType) {
                if (this.player.canPlayType('audio/mpeg')) {
                    params.push('mp3');
                }

                if (this.player.canPlayType('audio/ogg')) {
                    params.push('ogg');
                }

                if (this.player == audioEngine) {
                    params.push('html5');
                }
            }
            return params.join(',');
        },

        stop: function() {
            if (this.player) {
                this.player.stopStream();
            }
            this.playing = false;
        },

        setVolume: function(volume) {
            if (this.player) {
                this.player.setVolume(volume);
            }
        },

        updateVolume: function(volume) {
            volume = parseFloat(volume);
            this.volume = volume;
            this.setVolume(volume);
            storage.put('volume', volume);
        },

        loadVolume: function() {
            var volume = parseFloat(storage.get('volume'));
            // громкость не установлена в куках - берем по умолчанию
            if (isNaN(volume)) {
                volume = this.defaultVolume;
            }
            this.updateVolume(volume);
        },

        mute: function() {
            this.setVolume(0);
            this.muted = this.volume;
        },

        unmute: function() {
            this.updateVolume(this.muted || this.defaultVolume);
            this.muted = false;
        },

        isMuted: function() {
            // TODO: fix this shit
            return angular.isNumber(this.muted);
        },

        flashCallback: function(event) {
            if (event == 'stopped') {
                this.playing = false;
            }

            if (event == 'playing') {
                this.playing = true;
            }

            if (event == 'ready') {
                this.player = document.getElementById('flash-player-engine');
                this.setVolume(this.volume);
                this.play();
            }
        },

        init: function() {
            this.loadVolume();

            // html5 player fallback
            if (!flash.installed()) {
                this.tryHtml5Fallback();
            }
        },

        tryHtml5Fallback: function() {
            if (audioEngine && audioEngine.canPlayType('audio/mpeg')) {
                console.log('use html5 fallback');
                this.player = audioEngine;
            } else {
                this.player = null;
            }
        }
    };

    obj.init();
    return obj;
})

.factory('audioEngine', function($document) {
    var audio = $document[0].createElement('audio');
    if (audio.canPlayType) {
        return {
            playStream: function(url) {
                audio.src = url;
                audio.play();
            },

            stopStream: function() {
                audio.pause();
                audio.src = '';
            },

            setVolume: function(volume) {
                audio.volume = volume;
            },

            canPlayType: function(type) {
                return !!audio.canPlayType(type).replace(/^no$/, '');
            }
        }
    }
})

.factory('flash', function(){
    return {
        loaded: null,
        embed: function(src, id) {
            return swfobject.embedSWF(src, id, 1, 1, '10', false, {}, {
                allowScriptAccess: 'always',
                wmode: 'transparent'
            }, {});
        },

        installed: function() {
            return swfobject.hasFlashPlayerVersion('10');
        }
    }
})

.directive('flashEngine', function($window, $rootScope, player, flash){
    $window.flashPlayerCallback = function(event){
        player.flashCallback(event);
    };

    return {
        restrict: 'C',
        link: function(scope, element, attrs) {
            flash.embed(attrs.src, attrs.id);
        }
    };
});
