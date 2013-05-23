// add build tracking

package {
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.IOErrorEvent;
   import flash.events.ProgressEvent;
   import flash.events.IEventDispatcher;
   import flash.media.Sound;
   import flash.media.SoundChannel;
   import flash.media.SoundMixer;
   import flash.media.SoundTransform;
   import flash.media.SoundLoaderContext;
   import flash.net.URLRequest;
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
      private var _fadingTime:Number = 0.2; //secs
      private var _volume:Number = 0.6;
      private var _stopped:Boolean = true;

      public function Player() {
         Security.allowDomain("*");

         ExternalInterface.addCallback("playStream", playStream);

         ExternalInterface.addCallback("stopStream", stopStream);
         ExternalInterface.addCallback("canPlayType", canPlayType);
         ExternalInterface.addCallback("setVolume", setVolume);
         ExternalInterface.addCallback("getVolume", getVolume);
         ExternalInterface.addCallback("isPlaying", isPlaying);
         ExternalInterface.addCallback("getVersion", getVersion);

         _soundTransform = new SoundTransform(_volume);
         this.callback('ready');
         debug('ready ready');
      }

      public function playStream(url:String) {
          try {
              cancelStream();
              debug('stream url: '+url);

              _sound = new Sound();
              _sound.load(new URLRequest(url), new SoundLoaderContext(100));
              _sound.addEventListener(IOErrorEvent.IO_ERROR, onIOError);
              _sound.addEventListener(ProgressEvent.PROGRESS, onPlayStart);

              _soundChannel = _sound.play();
              _soundChannel.soundTransform = _soundTransform;
              stopped(false);
          } catch(e:Error) {
              debug('load stream: ' + e.message);
              this.callback('error', e.message);
          }
      }

      public function stopStream() {
         stopped(true);
         if (_soundChannel) {
             new EazeTween(_soundChannel).onComplete(cancelStream).to(_fadingTime, {volume: 0});
         }
      }

      public function cancelStream() {
         if (_soundChannel != null) {
             try {
                _soundChannel.stop();
                _sound.close();
             } catch(e:Error) {
                 debug('error while stopping: '+e.message);
             }
             _soundChannel = null;
         }
         stopped(true);
      }

       public function stopped(stopped:Boolean) {
           // if state changed
           if (stopped != _stopped) {
               this.callback(stopped ? 'stopped' : 'playing');
               _stopped = stopped;
           }
       }

      public function onPlayStart(event:Event) {
        var eventDispatcher:IEventDispatcher = IEventDispatcher(event.target);
        eventDispatcher.removeEventListener(event.type, arguments.callee);
      }

      private function onIOError(event:Event) {
        stopped(true);
        _soundChannel = null;
        _sound = null;

        debug('io-error: '+event.text);
        this.callbackWithData('error', event.text);
      }

      public function canPlayType(type:String) {
          return type == 'audio/mpeg';
      }

       public function setVolume(volume:Number) {
           _soundTransform.volume = volume;
           _volume = volume;

           if (_soundChannel != null) {
               _soundChannel.soundTransform = _soundTransform;
           }
       }

       public function getVolume(): Number {
           return _volume;
       }

       public function debug(vars:Object): void {
           //ExternalInterface.call('console.log', 'Player: ' + vars);
       }

       // вызов колбеков без отдельного потока (setTimeout(..., 0)) блокирует HTML UI
       public function callback(eventName:String) {
           ExternalInterface.call('setTimeout', 'flashPlayerCallback("'+eventName+'")', 1);
       }

       public function callbackWithData(eventName:String, data:Object) {
           ExternalInterface.call('setTimeout', 'flashPlayerCallback("'+eventName+'", "'+data+'")', 1);
       }

      public function isPlaying():Boolean {
         return !_stopped;
      }

      public function getVersion():String {
         return 'player v1.0.12';
      }


   }
}
