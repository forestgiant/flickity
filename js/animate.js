// animate
( function( window, factory ) {
  // universal module definition
  /* jshint strict: false */
  if ( typeof define == 'function' && define.amd ) {
    // AMD
    define( [
      'fizzy-ui-utils/utils'
    ], function( utils ) {
      return factory( window, utils );
    });
  } else if ( typeof module == 'object' && module.exports ) {
    // CommonJS
    module.exports = factory(
      window,
      require('fizzy-ui-utils')
    );
  } else {
    // browser global
    window.Flickity = window.Flickity || {};
    window.Flickity.animatePrototype = factory(
      window,
      window.fizzyUIUtils
    );
  }

}( window, function factory( window, utils ) {

'use strict';

// -------------------------- requestAnimationFrame -------------------------- //

// get rAF, prefixed, if present
var requestAnimationFrame = window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame;

// fallback to setTimeout
var lastTime = 0;
if ( !requestAnimationFrame )  {
  requestAnimationFrame = function( callback ) {
    var currTime = new Date().getTime();
    var timeToCall = Math.max( 0, 16 - ( currTime - lastTime ) );
    var id = setTimeout( callback, timeToCall );
    lastTime = currTime + timeToCall;
    return id;
  };
}

// -------------------------- animate -------------------------- //

var proto = {};

proto.startAnimation = function() {
  if ( this.isAnimating ) {
    return;
  }

  this.isAnimating = true;
  this.restingFrames = 0;
  this.animate();
};

proto.animate = function() {
  this.applyDragForce();
  this.applySelectedAttraction();

  var previousX = this.x,
      previousY = this.y;

  this.integratePhysics();
  this.positionSlider();
  if (this.options.verticalCells) {
    this.settle( previousY );
  } else {
    this.settle( previousX );
  }
  // animate next frame
  if ( this.isAnimating ) {
    var _this = this;
    requestAnimationFrame( function animateFrame() {
      _this.animate();
    });
  }
};


var transformProperty = ( function () {
  var style = document.documentElement.style;
  if ( typeof style.transform == 'string' ) {
    return 'transform';
  }
  return 'WebkitTransform';
})();

proto.positionSlider = function() {
    if(this.options.verticalCells) {
        var y = this.y;
        
        if ( this.options.wrapAround && this.cells.length > 1 ) {
            y = utils.modulo( y, this.slideableHeight );
            y = y - this.slideableHeight;
            this.shiftWrapCells( y );
        }

        y = y + this.cursorPosition;
        y = this.options.rightToLeft && transformProperty ? -y : y;
        var value = this.getPositionValue( y );

        this.slider.style[ transformProperty ] = this.isAnimating ?
            'translate3d(0,' + value + ',0)' : 'translateY(' + value + ')';
    } else {
        var x = this.x;
        
        if ( this.options.wrapAround && this.cells.length > 1 ) {
            x = utils.modulo( x, this.slideableWidth );
            x = x - this.slideableWidth;
            this.shiftWrapCells( x );
        }

        x = x + this.cursorPosition;
        x = this.options.rightToLeft && transformProperty ? -x : x;
        var value = this.getPositionValue( x );

        this.slider.style[ transformProperty ] = this.isAnimating ?
          'translate3d(' + value + ',0,0)' : 'translateX(' + value + ')';
    }

  // scroll event
  var firstSlide = this.slides[0];
  if ( firstSlide ) {
    var position,
        progress;

    if (this.options.verticalCellse) {
        position = -this.y - firstSlide.target;
        progress = position / this.slidesHeight;
    } else {
        position = -this.x - firstSlide.target;
        progress = position / this.slidesWidth;
    }

    this.dispatchEvent( 'scroll', null, [ progress, position ] );
  }
};

proto.positionSliderAtSelected = function() {
  if ( !this.cells.length ) {
    return;
  }
  if (this.options.verticalCells) {
    this.y = -this.selectedSlide.target;
  } else {
    this.x = -this.selectedSlide.target;
  }

  this.positionSlider();
};

proto.getPositionValue = function( position ) {
  if ( this.options.percentPosition ) {
    // percent position, round to 2 digits, like 12.34%
    return ( Math.round( ( position / this.size.innerWidth ) * 10000 ) * 0.01 )+ '%';
  } else {
    // pixel positioning
    return Math.round( position ) + 'px';
  }
};

proto.settle = function( previousX ) {
  // keep track of frames where x hasn't moved
  if ( !this.isPointerDown && Math.round( this.x * 100 ) == Math.round( previousX * 100 ) ) {
    this.restingFrames++;
  }
  // stop animating if resting for 3 or more frames
  if ( this.restingFrames > 2 ) {
    this.isAnimating = false;
    delete this.isFreeScrolling;
    // render position with translateX when settled
    this.positionSlider();
    this.dispatchEvent('settle');
  }
};

proto.shiftWrapCells = function( x ) {
    var beforeGap,
        afterGap;

    if (this.options.verticalCells) {
        beforeGap = this.cursorPosition +_y; 
        this._shiftCells( this.beforeShiftCells, beforeGap, -1 );
        afterGap = this.size.innerHeight - ( y + this.slideableHeight + this.cursorPosition );
    } else {
        // shift before cells
        beforeGap = this.cursorPosition + x;
        this._shiftCells( this.beforeShiftCells, beforeGap, -1 );
        // shift after cells
        afterGap = this.size.innerWidth - ( x + this.slideableWidth + this.cursorPosition );
  }

  this._shiftCells( this.afterShiftCells, afterGap, 1 );
};


proto._shiftCells = function( cells, gap, shift ) {
  for ( var i=0; i < cells.length; i++ ) {
    var cell = cells[i];
    var cellShift = gap > 0 ? shift : 0;
    cell.wrapShift( cellShift );
    if (this.options.verticalCells) {
        gap -= cell.size.outerHeight;
    } else {
        gap -= cell.size.outerWidth;
    }
  }
};

proto._unshiftCells = function( cells ) {
  if ( !cells || !cells.length ) {
    return;
  }
  for ( var i=0; i < cells.length; i++ ) {
    cells[i].wrapShift( 0 );
  }
};

// -------------------------- physics -------------------------- //

proto.integratePhysics = function() {
  if (this.options.verticalCells) {
    this.y += this.velocity;
  } else {
    this.x += this.velocity;
  }
  this.velocity *= this.getFrictionFactor();
};

proto.applyForce = function( force ) {
  this.velocity += force;
};

proto.getFrictionFactor = function() {
  return 1 - this.options[ this.isFreeScrolling ? 'freeScrollFriction' : 'friction' ];
};

proto.getRestingPosition = function() {
  // my thanks to Steven Wittens, who simplified this math greatly
  if (this.options.verticalCells) {
    return this.y + this.velocity / ( 1 - this.getFrictionFactor() );
  } else {
    return this.x + this.velocity / ( 1 - this.getFrictionFactor() );
  }
};

proto.applyDragForce = function() {
  if ( !this.isPointerDown ) {
    return;
  }
  var dragVelocity;
  // change the position to drag position by applying force
  if (this.options.verticalCells) {
    dragVelocity = this.dragY - this.y;
  } else {
    dragVelocity = this.dragX - this.x;
  }
  var dragForce = dragVelocity - this.velocity;
  this.applyForce( dragForce );
};

proto.applySelectedAttraction = function() {
  // do not attract if pointer down or no cells
  if ( this.isPointerDown || this.isFreeScrolling || !this.cells.length ) {
    return;
  }
  var distance;
  if (this.options.verticalCells) {
    distance = this.selectedSlide.target * -1 - this.y;
  } else {
    distance = this.selectedSlide.target * -1 - this.x;
  }

  var force = distance * this.options.selectedAttraction;
  this.applyForce( force );
};

return proto;

}));
