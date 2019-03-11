var LibraryEngine = {
	$Engine: {
		ctx : null,
		init: function() {
			console.log("$Engine.init");
			var canvas = Module["canvas"];
			Engine.ctx = canvas.getContext('2d');
		},
	    translateColorToCSSRGB: function(rgba) {
	      var ret = 'rgb(' + (rgba>>>24) + ',' + (rgba>>16 & 0xff) + ',' + (rgba>>8 & 0xff)  + ')';
	      return ret;
	    },
		filledEllipse: function(x, y, width, height, rgba) {
			Engine.ctx.globalAlpha = (rgba & 0xff) / 255;
			Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
			Engine.ctx.beginPath();
			Engine.ctx.ellipse(x, y, width, height, 0, 0, 2*Math.PI);
			Engine.ctx.fill();
		},
		filledRectangle: function(x, y, width, height, rgba) {
			Engine.ctx.globalAlpha = (rgba & 0xff) / 255;
			Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
			Engine.ctx.beginPath();
			Engine.ctx.fillRect(x, y, width, height);
			Engine.ctx.fill();
		},
		roundedRectangle: function(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {

			Engine.ctx.beginPath();
			Engine.ctx.moveTo(x + radius, y);
			Engine.ctx.lineTo(x + width - radius, y);
			Engine.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
			Engine.ctx.lineTo(x + width, y + height - radius);
			Engine.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
			Engine.ctx.lineTo(x + radius, y + height);
			Engine.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
			Engine.ctx.lineTo(x, y + radius);
			Engine.ctx.quadraticCurveTo(x, y, x + radius, y);
			Engine.ctx.closePath();
			var fillAlpha = (fillRgba & 0xff) / 255;
			var strokeAlpha = (strokeRgba & 0xff) / 255;
			if (fillAlpha > 0) {
				Engine.ctx.globalAlpha = fillAlpha;
				Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(fillRgba);
				Engine.ctx.fill();
			}
			if (strokeAlpha > 0) {
				Engine.ctx.globalAlpha = strokeAlpha;
				Engine.ctx.strokeStyle = Engine.translateColorToCSSRGB(strokeRgba);
				Engine.ctx.stroke();
			}
		},
		filledText: function(text, x, y, fontSize, rgba) {
      		text = UTF8ToString(text);
			Engine.ctx.globalAlpha = (rgba & 0xff) / 255;
			Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
			Engine.ctx.font = "" + fontSize + "px Monospace";
			Engine.ctx.beginPath();
			Engine.ctx.fillText(text, x, y);
			Engine.ctx.fill();
		},
	},

	Engine_Test1: function() {
		console.log("Test 1");
		return;
	},

	Engine_Init: function() {
		console.log("Engine_Init");
		Engine.init();
		return;
	},

	Engine_FilledEllipse: function(x, y, width, height, rgba) {
		Engine.filledEllipse(x, y, width, height, rgba);
	},

	Engine_FilledRectangle: function(x, y, width, height, rgba) {
		Engine.filledRectangle(x, y, width, height, rgba);
	},

	Engine_RoundedRectangle: function(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {
		Engine.roundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba);
	},

	Engine_FilledText: function(text, x, y, fontSize, rgba) {
		Engine.filledText(text, x, y, fontSize, rgba);
	},
};

autoAddDeps(LibraryEngine, '$Engine');
mergeInto(LibraryManager.library, LibraryEngine);