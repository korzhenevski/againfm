module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ';'
      },
      core: {
        src: ['core/angular.js', 'core/*.js', 'base.js', 'user.js'],
        dest: 'dist/core.full.js'
      },
      player: {
        src: [
            'common/swfobject.js',
            'common/comet.js',
            'common/ui-transition.js',
            'common/ui-animate.js',
            'sound.js',
            'player.js'
        ],
        dest: 'dist/player.full.js'
      }
    },

    ngmin: {
        core: {
            src: 'dist/core.full.js',
            dest: 'dist/core.ngmin.js'
        },

        player: {
            src: 'dist/player.full.js',
            dest: 'dist/player.ngmin.js'
        }
    },


    uglify: {
      options: {
        mangle: false,
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      core: {
        files: {'dist/core.js': ['dist/core.ngmin.js']}
      },
      player: {
        files: {'dist/player.js': ['dist/player.ngmin.js']}
      }
    }
  });

  grunt.loadNpmTasks('grunt-ngmin');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.registerTask('default', ['concat', 'ngmin', 'uglify']);
};