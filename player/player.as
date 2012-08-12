// add build tracking

package {
    import flash.display.Sprite;
    import flash.display.Graphics;
    import flash.display.MovieClip;
    import flash.events.Event;
    import flash.events.IOErrorEvent;
    import flash.events.SampleDataEvent;
    import flash.media.Sound;
    import flash.media.SoundChannel;
    import flash.media.SoundMixer;
    import flash.media.SoundTransform;
    import flash.net.URLRequest;
    import flash.utils.ByteArray;
    import flash.text.TextField;
    import flash.external.ExternalInterface;
    import flash.system.Security;
    import flash.display.LoaderInfo;
    import flash.utils.Timer;
    import flash.events.TimerEvent;
    import aze.motion.EazeTween;
    import aze.motion.specials.PropertyVolume;
    PropertyVolume.register();

    public class Player extends MovieClip {
        private var _soundTransform:SoundTransform;
        private var _soundChannel:SoundChannel;
        private var _sound:Sound;

        private var _fadingTime:Number = 1; //secs
        private var _volume:Number = 0.6;
        private var _preMuteVolume:Number = 0;
        private var _isMuted:Boolean = false;
        private var _startVolume:Number;
        private var _isPaused:Boolean = true;
        private var _spectrumTimer:Timer;
        private var _process_spectrum:Boolean;

        public function Player() {
            Security.allowDomain("*");
            var params:Object = LoaderInfo(this.root.loaderInfo).parameters;

            ExternalInterface.addCallback("loadStreamByUrl", loadStreamByUrl);
            ExternalInterface.addCallback("playStream", playStream);
            ExternalInterface.addCallback("pauseStream", pauseStream);
            ExternalInterface.addCallback("stopStream", stopStream);
            ExternalInterface.addCallback("stopStreamWithFade", stopStreamWithFade);
            ExternalInterface.addCallback("pauseStreamWithFade", pauseStreamWithFade);
            ExternalInterface.addCallback("setVolume", setVolume);
            ExternalInterface.addCallback("getVolume", getVolume);
            ExternalInterface.addCallback("mute", mute);
            ExternalInterface.addCallback("unmute", unmute);
            ExternalInterface.addCallback("isPaused", isPaused);
            ExternalInterface.addCallback("processSpectrum", processSpectrum);

            _volume = (params['volume'] != undefined) ? (parseFloat(params['volume']) / 100) : _volume;
            _process_spectrum = (params['process_spectrum'] == 'true');

            debug('volume: '+_volume+', process_spectrum: '+_process_spectrum);

            if (_process_spectrum) {
                _spectrumTimer = new Timer(100);
                _spectrumTimer.addEventListener(TimerEvent.TIMER, computeSpectrum);
            }

            _soundTransform = new SoundTransform(_volume);
            ExternalInterface.call('player.trigger', 'ready');
        }

        public function debug(vars:Object): void {
            ExternalInterface.call('console.log', 'Player: ' + vars);
        }

        private function computeSpectrum(event:Event): void {
            if (isPaused() || _sound == null || !_process_spectrum) {
                return;
            }

            var spectrum:Array = [];
            var bytes:ByteArray = new ByteArray();
            var i:int = 0;
            var val:Number = 0;

            _sound.extract(bytes, 512);
            bytes.position = 0;
            while(bytes.bytesAvailable > 0) {
                spectrum.push(bytes.readFloat());
                bytes.readFloat();
            }

            setSpectrum(spectrum);
        }

        public function loadStreamByUrl(url:String, startPlay:Boolean) {
            stopStream()
            debug('stream url: '+url)
            
            // TODO: make additional request and receive stream URL as plain text
            _sound = new Sound();
            _sound.load(new URLRequest(url));
            _sound.addEventListener(IOErrorEvent.IO_ERROR, onIOError, false, 0, true);

            if (startPlay == true) {
                playStream()
            }
        }

        public function playStream() {
            if (_sound != null) {
                _soundChannel = _sound.play();
                _soundChannel.soundTransform = _soundTransform;
                setPaused(false);
            } else {
                setPaused(true);
            }
        }

        // TODO: refactor tweener copypast
        public function pauseStreamWithFade() {
            if (_soundChannel) {
                new EazeTween(_soundChannel).onComplete(pauseStream).to(_fadingTime, {volume: 0});
            }
        }

        public function pauseStream() {
            if (_soundChannel != null) {
                _soundChannel.stop();
            }
            setPaused(true);
        }

        public function stopStreamWithFade() {
            if (_soundChannel) {
                new EazeTween(_soundChannel).onComplete(stopStream).to(_fadingTime, {volume: 0});
            }
        }

        public function stopStream() {
            if (_soundChannel != null) {
                _soundChannel.stop();
                _sound.close();
            }
            setPaused(true);
        }

        public function setPaused(paused:Boolean): void {
            _isPaused = paused;
            if (_isPaused) {
                setSpectrum([]);
                if (_spectrumTimer != undefined) {
                    _spectrumTimer.stop();
                }
            } else {
                if (_spectrumTimer != undefined) {
                    _spectrumTimer.start();
                }
            }
        }

        public function sendEvent() {
            // send via setTimeout(zero) 
            // performance reasons
        }

        public function processSpectrum(process:Boolean): void {
            _process_spectrum = process;
        }

        public function setVolume(volume:Number):void {
            volume = volume / 100
            _volume = volume;
            _soundTransform.volume = volume;

            if (_soundChannel != null) {
                _soundChannel.soundTransform = _soundTransform;
            }
        }

        public function getVolume():Number {
            if (_isMuted) {
                return 0;
            } else {
                return _volume * 100;
            }
        }

        public function unmute():void {
            setMuted(false);
        }

        public function mute():void {
            setMuted(true);
        }

        public function setMuted(muted:Boolean):void {
            // ignore if already set
            if ( (muted && _isMuted) || (!muted && !_isMuted))
                return;

            if (muted) {
                _preMuteVolume = _soundTransform.volume;
                setVolume(0);
            } else {
                setVolume(_preMuteVolume * 100);
            }

            _isMuted = muted;
        }

        public function isPaused():Boolean {
            return _isPaused;
        }

        private function onIOError(event:Event): void {
            _soundChannel = null;
            _sound = null;
            _isPaused = true;
       
            debug('io-error: '+event.text);
            ExternalInterface.call('player.trigger', 'error', event.text);
        }

        public function setSpectrum(spectrum:Array): void {
            ExternalInterface.call('App.player.setSpectrum', spectrum);
        }
    }
}