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
      private var _stopped:Boolean = true;

      public function Player() {
         Security.allowDomain("*");

         ExternalInterface.addCallback("playStream", playStream);
         ExternalInterface.addCallback("stopStream", stopStream);
         ExternalInterface.addCallback("stopStreamWithFade", stopStreamWithFade);
         ExternalInterface.addCallback("setVolume", setVolume);
         ExternalInterface.addCallback("getVolume", getVolume);
         ExternalInterface.addCallback("isPlaying", isPlaying);
         ExternalInterface.addCallback("getSpectrum", getSpectrum);
         ExternalInterface.addCallback("getVersion", getVersion);

         _soundTransform = new SoundTransform(_volume);
         this.callback('ready');
      }

      public function getSpectrum(points:Number) {
         var spectrum:Array = [];
         if (!isPlaying() || _sound == null) {
             return spectrum;
         }

         var bytes:ByteArray = new ByteArray();
         var i:int = 0;
         var val:Number = 0;

         _sound.extract(bytes, points);
         bytes.position = 0;
         while(bytes.bytesAvailable > 0) {
            spectrum.push((176 + bytes.readFloat() * 176) / 2);
            bytes.readFloat();
         }

         return spectrum;
      }

      public function playStream(url:String) {
          try {
              stopStream();
              debug('stream url: '+url);

              _sound = new Sound();
              _sound.load(new URLRequest(url));
              _sound.addEventListener(IOErrorEvent.IO_ERROR, onIOError);

              _soundChannel = _sound.play();
              _soundChannel.soundTransform = _soundTransform;
              stopped(false);
          } catch(e:Error) {
              debug('load stream: ' + e.message);
              this.callback('error', e.message);
          }
      }

      public function stopStreamWithFade() {
         stopped(true);
         if (_soundChannel) {
             new EazeTween(_soundChannel).onComplete(stopStream).to(_fadingTime, {volume: 0});
         }
      }

      public function stopStream() {
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
           ExternalInterface.call('setTimeout', 'flashPlayerCallback("'+eventName+'")', 0);
       }

       public function callbackWithData(eventName:String, data:Object) {
           ExternalInterface.call('setTimeout', 'flashPlayerCallback("'+eventName+'", "'+data+'")', 0);
       }

      public function isPlaying():Boolean {
         return !_stopped;
      }

      public function getVersion():String {
         return 'player v1.0.12';
      }



       private function onIOError(event:Event) {
           stopped(true);
           _soundChannel = null;
           _sound = null;

           debug('io-error: '+event.text);
           this.callbackWithData('error', event.text);
       }
   }
}
