App.RadioSpectrum = App.View.extend({
    el: '#spectrum',
    limit: 180,
    colors: ['#d86b26', '#d72f2e', '#0f9ac5'],
    running: false,
    enabled: true,
    mediator: App.mediator,

    initialize: function(options) {
        this.player = options.player;
        this.player.on('playing', this.start, this);
        this.player.on('stopped', this.stop, this);
        this.canvas = this.el.getContext('2d');
        _.bindAll(this, 'pullSpectrum', 'animate', '_updateDimensions', 'drawBlankLine');
        this.mediator.on('playback:spectrum', this.setEnabled, this);
        $(window).resize(_.throttle(this._updateDimensions, 200));
        this._updateDimensions();
    },

    setEnabled: function(enabled) {
        this.enabled = enabled;
        if (!this.player.isPlaying()) {
            return false;
        }
        if (this.enabled) {
            this.start();
        } else {
            this.stop();
        }
    },

    _updateDimensions: function() {
        this.width = this.$el.width();
        this.height = this.$el.height();
        this.lineSize = Math.floor(this.limit / this.colors.length);
        this.renderStep = Math.round(this.width / this.lineSize);
    },

    start: function() {
        this.running = true;
        this.points = [];
        this.drawBlankLine();
        if (this.enabled) {
            this.animate();
        }
    },

    stop: function() {
        this.running = false;
        this.points = [];
    },

    drawBlankLine: function() {
        this.clear();
        var ctx = this.canvas,
            color = '#f3f3f3',
            height = 50;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 2;

        ctx.moveTo(0, height);
        ctx.lineTo(this.width, height);
        ctx.stroke();
    },

    render: function() {
        if (!this.points.length || !this.running) {
            this.drawBlankLine();
            return;
        }
        this.clear();
        for(var lineIndex = 0; lineIndex < this.colors.length; lineIndex++) {
            var pos = 0,
                points = [],
                lim = (lineIndex + 1) * this.lineSize;
            var maxVal = this.height - 5;
            var c = 0;
            for (var i = lineIndex * this.lineSize; i < lim; i++) {
                var val = this.points[i];
                if (val > maxVal) {
                    val = maxVal;
                }
                if (val < 0) {
                    val = 5;
                }
                points.push([pos, val]);
                pos += this.renderStep;
                c++;
            }

            this.drawCurve(points, this.colors[lineIndex]);
        }
    },

    animate: function() {
        var duration = 420, interval = 35;
        var steps = duration / interval;
        var stepped;
        var step = [], from, to;
        var self = this;

        function computeStep() {
            var spectrum = self.pullSpectrum();
            if (! (spectrum && spectrum.length) ) {
                if (self.running) {
                    setTimeout(computeStep, 500);
                }
                return;
            }

            if (from && to) {
                to = from;
                from = spectrum;
            } else {
                from = [];
                for(var i = 0; i < self.limit; i++) {
                    from.push(50);
                }
                to = spectrum;
            }

            step = [];
            stepped = steps;
            for (var i = 0; i < from.length; i++) {
                var val = (to[i] - from[i]);
                if (val != 0) {
                    val = val / steps;
                }
                step[i] = val;
            }

            stepper();
        }

        function stepper(){
            if (!step.length) {
                return;
            }

            var current = [];
            for (var i = 0; i < from.length; i++) {
                from[i] = from[i] + step[i];
                current[i] = parseFloat(from[i].toFixed(2));
            }

            self.points = current;
            self.render();

            if (!self.running) {
                return;
            }

            if (--stepped) {
                setTimeout(stepper, interval);
            } else {
                computeStep();
            }
        }

        computeStep();
    },

    drawCurve: function(points, color) {
        var factor = 0.4,
            linewidth = 1,
            ctx = this.canvas;
        ctx.beginPath();

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 3;

        ctx.strokeStyle = color;
        ctx.lineWidth = linewidth;
        var len = points.length;

        for (var i = 0; i < len; ++i) {
            if (points[i] && typeof(points[i][1]) == 'number' && points[i + 1] && typeof(points[i + 1][1]) == 'number') {
                var coordX = points[i][0];
                var coordY = points[i][1];
                var nextX = points[i + 1][0];
                var nextY = points[i + 1][1];
                var prevX = points[i - 1] ? points[i - 1][0] : null;
                var prevY = points[i - 1] ? points[i - 1][1] : null;
                var offsetX = (points[i + 1][0] - points[i][0]) * factor;
                var offsetY = (points[i + 1][1] - points[i][1]) * factor;

                if (i == 0) {
                    ctx.moveTo(coordX, coordY);
                    ctx.lineTo(nextX - offsetX, nextY - offsetY);
                } else if (nextY == null) {
                    ctx.lineTo(coordX, coordY);
                } else if (prevY == null) {
                    ctx.moveTo(coordX, coordY);
                } else if (coordY == null) {
                    ctx.moveTo(nextX, nextY);
                } else {
                    ctx.quadraticCurveTo(coordX, coordY, coordX + offsetX, coordY + offsetY);
                    if (nextY) {
                        ctx.lineTo(nextX - offsetX, nextY - offsetY);
                    } else {
                        ctx.lineTo(coordX, coordY);
                    }
                }
            } else if (typeof(points[i][1]) == 'number') {
                ctx.lineTo(points[i][0], points[i][1]);
            }
        }
        ctx.stroke();
    },

    pullSpectrum: function() {
        return this.player.engine.getSpectrum(this.limit);
    },

    clear: function() {
        this.canvas.clearRect(0, 0, this.width, this.height);
    }
});
