(function () {
'use strict';

function noop() {}

function assign(tar, src) {
	for (var k in src) tar[k] = src[k];
	return tar;
}

function assignTrue(tar, src) {
	for (var k in src) tar[k] = 1;
	return tar;
}

function addLoc(element, file, line, column, char) {
	element.__svelte_meta = {
		loc: { file, line, column, char }
	};
}

function appendNode(node, target) {
	target.appendChild(node);
}

function insertNode(node, target, anchor) {
	target.insertBefore(node, anchor);
}

function detachNode(node) {
	node.parentNode.removeChild(node);
}

function reinsertChildren(parent, target) {
	while (parent.firstChild) target.appendChild(parent.firstChild);
}

function destroyEach(iterations, detach) {
	for (var i = 0; i < iterations.length; i += 1) {
		if (iterations[i]) iterations[i].d(detach);
	}
}

function createFragment() {
	return document.createDocumentFragment();
}

function createElement(name) {
	return document.createElement(name);
}

function createText(data) {
	return document.createTextNode(data);
}

function createComment() {
	return document.createComment('');
}

function addListener(node, event, handler) {
	node.addEventListener(event, handler, false);
}

function removeListener(node, event, handler) {
	node.removeEventListener(event, handler, false);
}

function setAttribute(node, attribute, value) {
	node.setAttribute(attribute, value);
}

function setStyle(node, key, value) {
	node.style.setProperty(key, value);
}

function linear(t) {
	return t;
}

function generateRule({ a, b, delta, duration }, ease, fn) {
	const step = 16.666 / duration;
	let keyframes = '{\n';

	for (let p = 0; p <= 1; p += step) {
		const t = a + delta * ease(p);
		keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
	}

	return keyframes + `100% {${fn(b, 1 - b)}}\n}`;
}

// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
	let hash = 5381;
	let i = str.length;

	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
	return hash >>> 0;
}

function wrapTransition(component, node, fn, params, intro) {
	let obj = fn(node, params);
	let duration;
	let ease;
	let cssText;

	let initialised = false;

	return {
		t: intro ? 0 : 1,
		running: false,
		program: null,
		pending: null,

		run(b, callback) {
			if (typeof obj === 'function') {
				transitionManager.wait().then(() => {
					obj = obj();
					this._run(b, callback);
				});
			} else {
				this._run(b, callback);
			}
		},

		_run(b, callback) {
			duration = obj.duration || 300;
			ease = obj.easing || linear;

			const program = {
				start: window.performance.now() + (obj.delay || 0),
				b,
				callback: callback || noop
			};

			if (intro && !initialised) {
				if (obj.css && obj.delay) {
					cssText = node.style.cssText;
					node.style.cssText += obj.css(0, 1);
				}

				if (obj.tick) obj.tick(0, 1);
				initialised = true;
			}

			if (!b) {
				program.group = transitionManager.outros;
				transitionManager.outros.remaining += 1;
			}

			if (obj.delay) {
				this.pending = program;
			} else {
				this.start(program);
			}

			if (!this.running) {
				this.running = true;
				transitionManager.add(this);
			}
		},

		start(program) {
			component.fire(`${program.b ? 'intro' : 'outro'}.start`, { node });

			program.a = this.t;
			program.delta = program.b - program.a;
			program.duration = duration * Math.abs(program.b - program.a);
			program.end = program.start + program.duration;

			if (obj.css) {
				if (obj.delay) node.style.cssText = cssText;

				const rule = generateRule(program, ease, obj.css);
				transitionManager.addRule(rule, program.name = '__svelte_' + hash(rule));

				node.style.animation = (node.style.animation || '')
					.split(', ')
					.filter(anim => anim && (program.delta < 0 || !/__svelte/.test(anim)))
					.concat(`${program.name} ${program.duration}ms linear 1 forwards`)
					.join(', ');
			}

			this.program = program;
			this.pending = null;
		},

		update(now) {
			const program = this.program;
			if (!program) return;

			const p = now - program.start;
			this.t = program.a + program.delta * ease(p / program.duration);
			if (obj.tick) obj.tick(this.t, 1 - this.t);
		},

		done() {
			const program = this.program;
			this.t = program.b;

			if (obj.tick) obj.tick(this.t, 1 - this.t);

			component.fire(`${program.b ? 'intro' : 'outro'}.end`, { node });

			if (!program.b && !program.invalidated) {
				program.group.callbacks.push(() => {
					program.callback();
					if (obj.css) transitionManager.deleteRule(node, program.name);
				});

				if (--program.group.remaining === 0) {
					program.group.callbacks.forEach(fn => {
						fn();
					});
				}
			} else {
				if (obj.css) transitionManager.deleteRule(node, program.name);
			}

			this.running = !!this.pending;
		},

		abort() {
			if (this.program) {
				if (obj.tick) obj.tick(1, 0);
				if (obj.css) transitionManager.deleteRule(node, this.program.name);
				this.program = this.pending = null;
				this.running = false;
			}
		},

		invalidate() {
			if (this.program) {
				this.program.invalidated = true;
			}
		}
	};
}

var transitionManager = {
	running: false,
	transitions: [],
	bound: null,
	stylesheet: null,
	activeRules: {},
	promise: null,

	add(transition) {
		this.transitions.push(transition);

		if (!this.running) {
			this.running = true;
			requestAnimationFrame(this.bound || (this.bound = this.next.bind(this)));
		}
	},

	addRule(rule, name) {
		if (!this.stylesheet) {
			const style = createElement('style');
			document.head.appendChild(style);
			transitionManager.stylesheet = style.sheet;
		}

		if (!this.activeRules[name]) {
			this.activeRules[name] = true;
			this.stylesheet.insertRule(`@keyframes ${name} ${rule}`, this.stylesheet.cssRules.length);
		}
	},

	next() {
		this.running = false;

		const now = window.performance.now();
		let i = this.transitions.length;

		while (i--) {
			const transition = this.transitions[i];

			if (transition.program && now >= transition.program.end) {
				transition.done();
			}

			if (transition.pending && now >= transition.pending.start) {
				transition.start(transition.pending);
			}

			if (transition.running) {
				transition.update(now);
				this.running = true;
			} else if (!transition.pending) {
				this.transitions.splice(i, 1);
			}
		}

		if (this.running) {
			requestAnimationFrame(this.bound);
		} else if (this.stylesheet) {
			let i = this.stylesheet.cssRules.length;
			while (i--) this.stylesheet.deleteRule(i);
			this.activeRules = {};
		}
	},

	deleteRule(node, name) {
		node.style.animation = node.style.animation
			.split(', ')
			.filter(anim => anim && anim.indexOf(name) === -1)
			.join(', ');
	},

	groupOutros() {
		this.outros = {
			remaining: 0,
			callbacks: []
		};
	},

	wait() {
		if (!transitionManager.promise) {
			transitionManager.promise = Promise.resolve();
			transitionManager.promise.then(() => {
				transitionManager.promise = null;
			});
		}

		return transitionManager.promise;
	}
};

function blankObject() {
	return Object.create(null);
}

function destroy(detach) {
	this.destroy = noop;
	this.fire('destroy');
	this.set = noop;

	this._fragment.d(detach !== false);
	this._fragment = null;
	this._state = {};
}

function destroyDev(detach) {
	destroy.call(this, detach);
	this.destroy = function() {
		console.warn('Component was already destroyed');
	};
}

function _differs(a, b) {
	return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

function _differsImmutable(a, b) {
	return a != a ? b == b : a !== b;
}

function fire(eventName, data) {
	var handlers =
		eventName in this._handlers && this._handlers[eventName].slice();
	if (!handlers) return;

	for (var i = 0; i < handlers.length; i += 1) {
		var handler = handlers[i];

		if (!handler.__calling) {
			handler.__calling = true;
			handler.call(this, data);
			handler.__calling = false;
		}
	}
}

function get() {
	return this._state;
}

function init(component, options) {
	component._handlers = blankObject();
	component._bind = options._bind;

	component.options = options;
	component.root = options.root || component;
	component.store = options.store || component.root.store;
}

function on(eventName, handler) {
	var handlers = this._handlers[eventName] || (this._handlers[eventName] = []);
	handlers.push(handler);

	return {
		cancel: function() {
			var index = handlers.indexOf(handler);
			if (~index) handlers.splice(index, 1);
		}
	};
}

function set(newState) {
	this._set(assign({}, newState));
	if (this.root._lock) return;
	this.root._lock = true;
	callAll(this.root._beforecreate);
	callAll(this.root._oncreate);
	callAll(this.root._aftercreate);
	this.root._lock = false;
}

function _set(newState) {
	var oldState = this._state,
		changed = {},
		dirty = false;

	for (var key in newState) {
		if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
	}
	if (!dirty) return;

	this._state = assign(assign({}, oldState), newState);
	this._recompute(changed, this._state);
	if (this._bind) this._bind(changed, this._state);

	if (this._fragment) {
		this.fire("state", { changed: changed, current: this._state, previous: oldState });
		this._fragment.p(changed, this._state);
		this.fire("update", { changed: changed, current: this._state, previous: oldState });
	}
}

function setDev(newState) {
	if (typeof newState !== 'object') {
		throw new Error(
			this._debugName + '.set was called without an object of data key-values to update.'
		);
	}

	this._checkReadOnly(newState);
	set.call(this, newState);
}

function callAll(fns) {
	while (fns && fns.length) fns.shift()();
}

function _mount(target, anchor) {
	this._fragment[this._fragment.i ? 'i' : 'm'](target, anchor || null);
}

function removeFromStore() {
	this.store._remove(this);
}

var protoDev = {
	destroy: destroyDev,
	get,
	fire,
	on,
	set: setDev,
	_recompute: noop,
	_set,
	_mount,
	_differs
};

var a = typeof document !== 'undefined' && document.createElement( 'a' );
var QUERYPAIR_REGEX = /^([\w\-]+)(?:=([^&]*))?$/;
var HANDLERS = [ 'beforeenter', 'enter', 'leave', 'update' ];

var isInitial = true;

function RouteData (ref) {
	var route = ref.route;
	var pathname = ref.pathname;
	var params = ref.params;
	var query = ref.query;
	var hash = ref.hash;
	var scrollX = ref.scrollX;
	var scrollY = ref.scrollY;

	this.pathname = pathname;
	this.params = params;
	this.query = query;
	this.hash = hash;
	this.isInitial = isInitial;
	this.scrollX = scrollX;
	this.scrollY = scrollY;

	this._route = route;

	isInitial = false;
}

RouteData.prototype = {
	matches: function matches ( href ) {
		return this._route.matches( href );
	}
};

function Route ( path, options ) {
	var this$1 = this;

	// strip leading slash
	if ( path[0] === '/' ) {
		path = path.slice( 1 );
	}

	this.path = path;
	this.segments = path.split( '/' );

	if ( typeof options === 'function' ) {
		options = {
			enter: options
		};
	}

	this.updateable = typeof options.update === 'function';

	HANDLERS.forEach( function (handler) {
		this$1[ handler ] = function ( route, other ) {
			var value;

			if ( options[ handler ] ) {
				value = options[ handler ]( route, other );
			}

			return roadtrip.Promise.resolve( value );
		};
	});
}

Route.prototype = {
	matches: function matches$1 ( href ) {
		a.href = href;

		var pathname = a.pathname.indexOf( '/' ) === 0 ? 
			a.pathname.slice( 1 ) :
			a.pathname;
		var segments = pathname.split( '/' );

		return segmentsMatch( segments, this.segments );
	},

	exec: function exec ( target ) {
		var this$1 = this;

		a.href = target.href;

		var pathname = a.pathname.indexOf( '/' ) === 0 ? 
			a.pathname.slice( 1 ) :
			a.pathname;
		var search = a.search.slice( 1 );

		var segments = pathname.split( '/' );

		if ( segments.length !== this.segments.length ) {
			return false;
		}

		var params = {};

		for ( var i = 0; i < segments.length; i += 1 ) {
			var segment = segments[i];
			var toMatch = this$1.segments[i];

			if ( toMatch[0] === ':' ) {
				params[ toMatch.slice( 1 ) ] = segment;
			}

			else if ( segment !== toMatch ) {
				return false;
			}
		}

		var query = {};
		var queryPairs = search.split( '&' );

		for ( var i$1 = 0; i$1 < queryPairs.length; i$1 += 1 ) {
			var match = QUERYPAIR_REGEX.exec( queryPairs[i$1] );

			if ( match ) {
				var key = match[1];
				var value = decodeURIComponent( match[2] );

				if ( query.hasOwnProperty( key ) ) {
					if ( typeof query[ key ] !== 'object' ) {
						query[ key ] = [ query[ key ] ];
					}

					query[ key ].push( value );
				}

				else {
					query[ key ] = value;
				}
			}
		}

		return new RouteData({
			route: this,
			pathname: pathname,
			params: params,
			query: query,
			hash: a.hash.slice( 1 ),
			scrollX: target.scrollX,
			scrollY: target.scrollY
		});
	}
};

function segmentsMatch ( a, b ) {
	if ( a.length !== b.length ) { return; }

	var i = a.length;
	while ( i-- ) {
		if ( ( a[i] !== b[i] ) && ( b[i][0] !== ':' ) ) {
			return false;
		}
	}

	return true;
}

var window$1 = ( typeof window !== 'undefined' ? window : null );

var routes = [];

// Adapted from https://github.com/visionmedia/page.js
// MIT license https://github.com/visionmedia/page.js#license

function watchLinks ( callback ) {
	window$1.addEventListener( 'click', handler, false );
	window$1.addEventListener( 'touchstart', handler, false );

	function handler ( event ) {
		if ( which( event ) !== 1 ) { return; }
		if ( event.metaKey || event.ctrlKey || event.shiftKey ) { return; }
		if ( event.defaultPrevented ) { return; }

		// ensure target is a link
		var el = event.target;

		// el.nodeName for svg links are 'a' instead of 'A'
		while ( el && el.nodeName.toUpperCase() !== 'A' ) {
			el = el.parentNode;
		}

		if ( !el || el.nodeName.toUpperCase() !== 'A' ) { return; }

		// check if link is inside an svg
		// in this case, both href and target are always inside an object
		var svg = ( typeof el.href === 'object' ) && el.href.constructor.name === 'SVGAnimatedString';

		// Ignore if tag has
		// 1. 'download' attribute
		// 2. rel='external' attribute
		if ( el.hasAttribute( 'download' ) || el.getAttribute( 'rel' ) === 'external' ) { return; }

		// ensure non-hash for the same path

		// Check for mailto: in the href
		if ( ~el.href.indexOf( 'mailto:' ) ) { return; }

		// check target
		// svg target is an object and its desired value is in .baseVal property
		if ( svg ? el.target.baseVal : el.target ) { return; }

		// x-origin
		// note: svg links that are not relative don't call click events (and skip watchLinks)
		// consequently, all svg links tested inside watchLinks are relative and in the same origin
		if ( !svg && !sameOrigin( el.href ) ) { return; }

		// rebuild path
		// There aren't .pathname and .search properties in svg links, so we use href
		// Also, svg href is an object and its desired value is in .baseVal property
		var path = svg ? el.href.baseVal : ( el.pathname + el.search + ( el.hash || '' ) );

		// strip leading '/[drive letter]:' on NW.js on Windows
		if ( typeof process !== 'undefined' && path.match( /^\/[a-zA-Z]:\// ) ) {
			path = path.replace( /^\/[a-zA-Z]:\//, '/' );
		}

		// same page
		var orig = path;

		if ( path.indexOf( roadtrip.base ) === 0 ) {
			path = path.substr( roadtrip.base.length );
		}

		if ( roadtrip.base && orig === path ) { return; }

		// no match? allow navigation
		if ( !routes.some( function (route) { return route.matches( orig ); } ) ) { return; }

		event.preventDefault();
		callback( orig );
	}
}

function which ( event ) {
	event = event || window$1.event;
	return event.which === null ? event.button : event.which;
}

function sameOrigin ( href ) {
	var origin = location.protocol + '//' + location.hostname;
	if ( location.port ) { origin += ':' + location.port; }

	return ( href && ( href.indexOf( origin ) === 0 ) );
}

function isSameRoute ( routeA, routeB, dataA, dataB ) {
	if ( routeA !== routeB ) {
		return false;
	}

	return (
		dataA.hash === dataB.hash &&
		deepEqual( dataA.params, dataB.params ) &&
		deepEqual( dataA.query, dataB.query )
	);
}

function deepEqual ( a, b ) {
	if ( a === null && b === null ) {
		return true;
	}

	if ( isArray( a ) && isArray( b ) ) {
		var i = a.length;

		if ( b.length !== i ) { return false; }

		while ( i-- ) {
			if ( !deepEqual( a[i], b[i] ) ) {
				return false;
			}
		}

		return true;
	}

	else if ( typeof a === 'object' && typeof b === 'object' ) {
		var aKeys = Object.keys( a );
		var bKeys = Object.keys( b );

		var i$1 = aKeys.length;

		if ( bKeys.length !== i$1 ) { return false; }

		while ( i$1-- ) {
			var key = aKeys[i$1];

			if ( !b.hasOwnProperty( key ) || !deepEqual( b[ key ], a[ key ] ) ) {
				return false;
			}
		}

		return true;
	}

	return a === b;
}

var toString = Object.prototype.toString;

function isArray ( thing ) {
	return toString.call( thing ) === '[object Array]';
}

// Enables HTML5-History-API polyfill: https://github.com/devote/HTML5-History-API
var location$1 = window$1 && ( window$1.history.location || window$1.location );

function noop$1 () {}

var currentData = {};
var currentRoute = {
	enter: function () { return roadtrip.Promise.resolve(); },
	leave: function () { return roadtrip.Promise.resolve(); }
};

var _target;
var isTransitioning = false;

var scrollHistory = {};
var uniqueID = 1;
var currentID = uniqueID;

var roadtrip = {
	base: '',
	Promise: Promise,

	add: function add ( path, options ) {
		routes.push( new Route( path, options ) );
		return roadtrip;
	},

	start: function start ( options ) {
		if ( options === void 0 ) options = {};

		var href = routes.some( function (route) { return route.matches( location$1.href ); } ) ?
			location$1.href :
			options.fallback;

		return roadtrip.goto( href, {
			replaceState: true,
			scrollX: window$1.scrollX,
			scrollY: window$1.scrollY
		});
	},

	goto: function goto ( href, options ) {
		if ( options === void 0 ) options = {};

		scrollHistory[ currentID ] = {
			x: window$1.scrollX,
			y: window$1.scrollY
		};

		var target;
		var promise = new roadtrip.Promise( function ( fulfil, reject ) {
			target = _target = {
				href: href,
				scrollX: options.scrollX || 0,
				scrollY: options.scrollY || 0,
				options: options,
				fulfil: fulfil,
				reject: reject
			};
		});

		_target.promise = promise;

		if ( isTransitioning ) {
			return promise;
		}

		_goto( target );
		return promise;
	}
};

if ( window$1 ) {
	watchLinks( function (href) { return roadtrip.goto( href ); } );

	// watch history
	window$1.addEventListener( 'popstate', function (event) {
		if ( !event.state ) { return; } // hashchange, or otherwise outside roadtrip's control
		var scroll = scrollHistory[ event.state.uid ];

		_target = {
			href: location$1.href,
			scrollX: scroll.x,
			scrollY: scroll.y,
			popstate: true, // so we know not to manipulate the history
			fulfil: noop$1,
			reject: noop$1
		};

		_goto( _target );
		currentID = event.state.uid;
	}, false );
}

function _goto ( target ) {
	var newRoute;
	var newData;

	for ( var i = 0; i < routes.length; i += 1 ) {
		var route = routes[i];
		newData = route.exec( target );

		if ( newData ) {
			newRoute = route;
			break;
		}
	}

	if ( !newRoute || isSameRoute( newRoute, currentRoute, newData, currentData ) ) {
		target.fulfil();
		return;
	}

	scrollHistory[ currentID ] = {
		x: ( currentData.scrollX = window$1.scrollX ),
		y: ( currentData.scrollY = window$1.scrollY )
	};

	isTransitioning = true;

	var promise;

	if ( ( newRoute === currentRoute ) && newRoute.updateable ) {
		promise = newRoute.update( newData );
	} else {
		promise = roadtrip.Promise.all([
			currentRoute.leave( currentData, newData ),
			newRoute.beforeenter( newData, currentData )
		]).then( function () { return newRoute.enter( newData, currentData ); } );
	}

	promise
		.then( function () {
			currentRoute = newRoute;
			currentData = newData;

			isTransitioning = false;

			// if the user navigated while the transition was taking
			// place, we need to do it all again
			if ( _target !== target ) {
				_goto( _target );
				_target.promise.then( target.fulfil, target.reject );
			} else {
				target.fulfil();
			}
		})
		.catch( target.reject );

	if ( target.popstate ) { return; }

	var ref = target.options;
	var replaceState = ref.replaceState;
	var invisible = ref.invisible;
	if ( invisible ) { return; }

	var uid = replaceState ? currentID : ++uniqueID;
	history[ replaceState ? 'replaceState' : 'pushState' ]( { uid: uid }, '', target.href );

	currentID = uid;
	scrollHistory[ currentID ] = {
		x: target.scrollX,
		y: target.scrollY
	};
}

var SVG = '<svg xmlns="http://www.w3.org/2000/svg" style="display: none;"><symbol id="line" viewBox="0 0 491.858 491.858"><title>line</title><path d="M465.167,211.613H240.21H26.69c-8.424,0-26.69,11.439-26.69,34.316s18.267,34.316,26.69,34.316h213.52h224.959 c8.421,0,26.689-11.439,26.689-34.316S473.59,211.613,465.167,211.613z"/></symbol><symbol id="cancel" viewBox="0 0 300.003 300.003"><title>cancel</title><path d="M150,0C67.159,0,0.001,67.159,0.001,150c0,82.838,67.157,150.003,149.997,150.003S300.002,232.838,300.002,150 C300.002,67.159,232.839,0,150,0z M206.584,207.171c-5.989,5.984-15.691,5.984-21.675,0l-34.132-34.132l-35.686,35.686 c-5.986,5.984-15.689,5.984-21.672,0c-5.989-5.991-5.989-15.691,0-21.68l35.683-35.683L95.878,118.14 c-5.984-5.991-5.984-15.691,0-21.678c5.986-5.986,15.691-5.986,21.678,0l33.222,33.222l31.671-31.673 c5.986-5.984,15.694-5.986,21.675,0c5.989,5.991,5.989,15.697,0,21.678l-31.668,31.671l34.13,34.132 C212.57,191.475,212.573,201.183,206.584,207.171z"/></symbol><symbol id="close" viewBox="0 0 47.971 47.971"><title>close</title><path d="M28.228,23.986L47.092,5.122c1.172-1.171,1.172-3.071,0-4.242c-1.172-1.172-3.07-1.172-4.242,0L23.986,19.744L5.121,0.88 c-1.172-1.172-3.07-1.172-4.242,0c-1.172,1.171-1.172,3.071,0,4.242l18.865,18.864L0.879,42.85c-1.172,1.171-1.172,3.071,0,4.242 C1.465,47.677,2.233,47.97,3,47.97s1.535-0.293,2.121-0.879l18.865-18.864L42.85,47.091c0.586,0.586,1.354,0.879,2.121,0.879 s1.535-0.293,2.121-0.879c1.172-1.171,1.172-3.071,0-4.242L28.228,23.986z"/></symbol><symbol id="tick" viewBox="0 0 191.667 191.667"><title>tick</title><path d="M95.833,0C42.991,0,0,42.99,0,95.833s42.991,95.834,95.833,95.834s95.833-42.991,95.833-95.834S148.676,0,95.833,0z M150.862,79.646l-60.207,60.207c-2.56,2.56-5.963,3.969-9.583,3.969c-3.62,0-7.023-1.409-9.583-3.969l-30.685-30.685 c-2.56-2.56-3.97-5.963-3.97-9.583c0-3.621,1.41-7.024,3.97-9.584c2.559-2.56,5.962-3.97,9.583-3.97c3.62,0,7.024,1.41,9.583,3.971 l21.101,21.1l50.623-50.623c2.56-2.56,5.963-3.969,9.583-3.969c3.62,0,7.023,1.409,9.583,3.969 C156.146,65.765,156.146,74.362,150.862,79.646z"/></symbol><symbol id="danger" viewBox="0 0 44.271 44.271"><title>danger</title><path d="M42.355,10.833l-9.189-9.066c-1.092-1.091-2.674-1.684-4.217-1.684H14.547c-1.541,0-3.02,0.593-4.11,1.684l-8.909,9.076 C0.437,11.934,0,13.404,0,14.945v14.402c0,1.542,0.437,3.021,1.528,4.111l8.998,9.056c1.09,1.09,2.481,1.674,4.022,1.674h14.403 c1.541,0,3.021-0.584,4.111-1.674l9.295-9.071c1.09-1.09,1.914-2.555,1.914-4.097V14.944 C44.269,13.403,43.447,11.924,42.355,10.833z M22.134,32.766c-1.528,0-2.766-1.264-2.766-2.823c0-1.561,1.238-2.824,2.766-2.824 s2.767,1.264,2.767,2.824C24.9,31.502,23.662,32.766,22.134,32.766z M24.9,22.375c0,1.559-1.207,2.822-2.767,2.822 s-2.767-1.264-2.767-2.822v-11.65c0-1.559,1.207-2.824,2.767-2.824S24.9,9.166,24.9,10.724V22.375z"/></symbol><symbol id="info-button" viewBox="0 0 45.999 45.999"><title>info-button</title><path d="M39.264,6.736c-8.982-8.981-23.545-8.982-32.528,0c-8.982,8.982-8.981,23.545,0,32.528c8.982,8.98,23.545,8.981,32.528,0 C48.245,30.281,48.244,15.719,39.264,6.736z M25.999,33c0,1.657-1.343,3-3,3s-3-1.343-3-3V21c0-1.657,1.343-3,3-3s3,1.343,3,3V33z M22.946,15.872c-1.728,0-2.88-1.224-2.844-2.735c-0.036-1.584,1.116-2.771,2.879-2.771c1.764,0,2.88,1.188,2.917,2.771 C25.897,14.648,24.746,15.872,22.946,15.872z"/></symbol></svg>';

/* src\components\Link.html generated by Svelte v2.8.0 */

function data() {
  return {
    cssClass: ''
  }
}
var methods = {
  handleHref(path, e) {
    e.preventDefault();
    roadtrip.goto(path);
  }
};

const file = "src\\components\\Link.html";

function create_main_fragment(component, ctx) {
	var a, slot_content_default = component._slotted.default, a_class_value;

	function click_handler(event) {
		component.handleHref(ctx.href, event);
	}

	return {
		c: function create() {
			a = createElement("a");
			addListener(a, "click", click_handler);
			a.href = ctx.href;
			a.className = a_class_value = "LinkComp " + (ctx.cssClass || '');
			addLoc(a, file, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(a, target, anchor);

			if (slot_content_default) {
				appendNode(slot_content_default, a);
			}
		},

		p: function update(changed, _ctx) {
			ctx = _ctx;
			if (changed.href) {
				a.href = ctx.href;
			}

			if ((changed.cssClass) && a_class_value !== (a_class_value = "LinkComp " + (ctx.cssClass || ''))) {
				a.className = a_class_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(a);
			}

			if (slot_content_default) {
				reinsertChildren(a, slot_content_default);
			}

			removeListener(a, "click", click_handler);
		}
	};
}

function Link(options) {
	this._debugName = '<Link>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign(data(), options.data);
	if (!('href' in this._state)) console.warn("<Link> was created without expected data property 'href'");
	if (!('cssClass' in this._state)) console.warn("<Link> was created without expected data property 'cssClass'");
	this._intro = true;

	this._slotted = options.slots || {};

	this.slots = {};

	this._fragment = create_main_fragment(this, this._state);

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(Link.prototype, protoDev);
assign(Link.prototype, methods);

Link.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

/* src\components\Menu.html generated by Svelte v2.8.0 */

const catsData = {
	"event": {
			"menu": "Event Sign Up",
			"desc": "",
			"img": ""
		},
		"speakers": {
			"menu": "Speaker Bios",
			"desc": "",
			"img": ""
		},		
	"faq": {
			"menu": "Why the Shroud?",
			"desc": "",
			"img": ""
		},
		"videos": {
			"menu": "Shroud Videos",
			"desc": "",
			"img": ""
		},
		"articles": {
			"menu": "Shroud Resources",
			"desc": "",
			"img": ""
		},
		"about": {
			"menu": "About Us",
			"desc": "",
			"img": ""
		},
		"donate": {
			"menu": "Donate",
			"desc": "",
			"img": ""
		}
};

// let cats = [];
//   for (let cat in catsData) {
//   cats.push({id: cat, ...catsData[cat]});
// }
// you don't need to do map AND entries - just 1 will do!! Just use [0] for the key, [1] for the value
 let cats = Object.entries(catsData);

//console.log('cats are now '+JSON.stringify(cats))
 //each Object.entries(obj) and each [...iterable].

  function data$1() {
	return { 
		snippets: [],
		sectionColors: [],
		cats: cats,
	 }
	}
var methods$1 = {
  goto(path) {
    roadtrip.goto(path);
  }
};

function oncreate() {

			/* get the colors for each menu item to use in their section */
			let sections = document.querySelectorAll('nav > ul > li > a');
			let sectionColors = {};
			for (let element of sections) {
				const id = element.parentNode.getAttribute('data-id');
				const color1 = window.getComputedStyle(element).borderLeftColor;
				const color2 = window.getComputedStyle(element,':after').backgroundColor;
				sectionColors[id] = {color1,color2};
			}
			store.set({ cats:cats, sectionColors:sectionColors });
			/* the windowise method for embedding beautiful SVGs in their modals
			not sure I want to do this, but let's try and see how this goes! */

			let dom = document.createElement('div');

			dom.setAttribute('hidden', '');
			dom.innerHTML = SVG;
			document.body.insertBefore(dom, document.body.firstChild);

	}
function onstate({ changed, current, previous }) {
			// this fires before oncreate, and on every state change.
			// the first time it runs, `previous` is undefined
			if (changed.snippets) {
				console.log('hey snippets have changed');
			}
	}
const file$1 = "src\\components\\Menu.html";

function create_main_fragment$1(component, ctx) {
	var div, text, text_1, nav, ul;

	var each_value = ctx.cats;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(component, get_each_context(ctx, each_value, i));
	}

	return {
		c: function create() {
			div = createElement("div");
			text = createText("Shroud Alaska Group");
			text_1 = createText("\r\n\r\n");
			nav = createElement("nav");
			ul = createElement("ul");

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
			div.className = "topTitle";
			addLoc(div, file$1, 0, 0, 0);
			addLoc(ul, file$1, 3, 2, 61);
			addLoc(nav, file$1, 2, 0, 51);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(text, div);
			insertNode(text_1, target, anchor);
			insertNode(nav, target, anchor);
			appendNode(ul, nav);

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(ul, null);
			}
		},

		p: function update(changed, ctx) {
			if (changed.cats) {
				each_value = ctx.cats;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
				detachNode(text_1);
				detachNode(nav);
			}

			destroyEach(each_blocks, detach);
		}
	};
}

// (5:1) {#each cats as cat}
function create_each_block(component, ctx) {
	var li, text_value = ctx.cat[1].menu, text, li_data_id_value;

	var link_initial_data = { href: "/topics/" + ctx.cat[0] };
	var link = new Link({
		root: component.root,
		store: component.store,
		slots: { default: createFragment() },
		data: link_initial_data
	});

	return {
		c: function create() {
			li = createElement("li");
			text = createText(text_value);
			link._fragment.c();
			li.dataset.id = li_data_id_value = ctx.cat[0];
			addLoc(li, file$1, 5, 3, 92);
		},

		m: function mount(target, anchor) {
			insertNode(li, target, anchor);
			appendNode(text, link._slotted.default);
			link._mount(li, null);
		},

		p: function update(changed, ctx) {
			if ((changed.cats) && text_value !== (text_value = ctx.cat[1].menu)) {
				text.data = text_value;
			}

			var link_changes = {};
			if (changed.cats) link_changes.href = "/topics/" + ctx.cat[0];
			link._set(link_changes);

			if ((changed.cats) && li_data_id_value !== (li_data_id_value = ctx.cat[0])) {
				li.dataset.id = li_data_id_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(li);
			}

			link.destroy();
		}
	};
}

function get_each_context(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.cat = list[i];
	child_ctx.each_value = list;
	child_ctx.cat_index = i;
	return child_ctx;
}

function Menu(options) {
	this._debugName = '<Menu>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign(data$1(), options.data);
	if (!('cats' in this._state)) console.warn("<Menu> was created without expected data property 'cats'");
	this._intro = true;

	this._handlers.state = [onstate];

	if (!options.root) {
		this._oncreate = [];
		this._beforecreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment$1(this, this._state);

	this.root._oncreate.push(() => {
		onstate.call(this, { changed: assignTrue({}, this._state), current: this._state });
		oncreate.call(this);
		this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
	});

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);

		this._lock = true;
		callAll(this._beforecreate);
		callAll(this._oncreate);
		callAll(this._aftercreate);
		this._lock = false;
	}
}

assign(Menu.prototype, protoDev);
assign(Menu.prototype, methods$1);

Menu.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

function Store(state, options) {
	this._handlers = {};
	this._dependents = [];

	this._computed = blankObject();
	this._sortedComputedProperties = [];

	this._state = assign({}, state);
	this._differs = options && options.immutable ? _differsImmutable : _differs;
}

assign(Store.prototype, {
	_add(component, props) {
		this._dependents.push({
			component: component,
			props: props
		});
	},

	_init(props) {
		const state = {};
		for (let i = 0; i < props.length; i += 1) {
			const prop = props[i];
			state['$' + prop] = this._state[prop];
		}
		return state;
	},

	_remove(component) {
		let i = this._dependents.length;
		while (i--) {
			if (this._dependents[i].component === component) {
				this._dependents.splice(i, 1);
				return;
			}
		}
	},

	_set(newState, changed) {
		const previous = this._state;
		this._state = assign(assign({}, previous), newState);

		for (let i = 0; i < this._sortedComputedProperties.length; i += 1) {
			this._sortedComputedProperties[i].update(this._state, changed);
		}

		this.fire('state', {
			changed,
			previous,
			current: this._state
		});

		const dependents = this._dependents.slice(); // guard against mutations
		for (let i = 0; i < dependents.length; i += 1) {
			const dependent = dependents[i];
			const componentState = {};
			let dirty = false;

			for (let j = 0; j < dependent.props.length; j += 1) {
				const prop = dependent.props[j];
				if (prop in changed) {
					componentState['$' + prop] = this._state[prop];
					dirty = true;
				}
			}

			if (dirty) dependent.component.set(componentState);
		}

		this.fire('update', {
			changed,
			previous,
			current: this._state
		});
	},

	_sortComputedProperties() {
		const computed = this._computed;
		const sorted = this._sortedComputedProperties = [];
		const visited = blankObject();
		let currentKey;

		function visit(key) {
			const c = computed[key];

			if (c) {
				c.deps.forEach(dep => {
					if (dep === currentKey) {
						throw new Error(`Cyclical dependency detected between ${dep} <-> ${key}`);
					}

					visit(dep);
				});

				if (!visited[key]) {
					visited[key] = true;
					sorted.push(c);
				}
			}
		}

		for (const key in this._computed) {
			visit(currentKey = key);
		}
	},

	compute(key, deps, fn) {
		let value;

		const c = {
			deps,
			update: (state, changed, dirty) => {
				const values = deps.map(dep => {
					if (dep in changed) dirty = true;
					return state[dep];
				});

				if (dirty) {
					const newValue = fn.apply(null, values);
					if (this._differs(newValue, value)) {
						value = newValue;
						changed[key] = true;
						state[key] = value;
					}
				}
			}
		};

		this._computed[key] = c;
		this._sortComputedProperties();

		const state = assign({}, this._state);
		const changed = {};
		c.update(state, changed, true);
		this._set(state, changed);
	},

	fire,

	get,

	on,

	set(newState) {
		const oldState = this._state;
		const changed = this._changed = {};
		let dirty = false;

		for (const key in newState) {
			if (this._computed[key]) throw new Error(`'${key}' is a read-only property`);
			if (this._differs(newState[key], oldState[key])) changed[key] = dirty = true;
		}
		if (!dirty) return;

		this._set(newState, changed);
	}
});

/* src\pages\index\index.html generated by Svelte v2.8.0 */

var methods$2 = {
  goto(path) {
    roadtrip.goto(path);
  }
};

const file$2 = "src\\pages\\index\\index.html";

function create_main_fragment$2(component, ctx) {
	var div;

	return {
		c: function create() {
			div = createElement("div");
			div.className = "content is-medium home svelte-ziporw";
			addLoc(div, file$2, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
		},

		p: noop,

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}
		}
	};
}

function Index(options) {
	this._debugName = '<Index>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign({}, options.data);
	this._intro = true;

	this._fragment = create_main_fragment$2(this, this._state);

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(Index.prototype, protoDev);
assign(Index.prototype, methods$2);

Index.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

class IndexHandler {
  get route() {
    return {
      enter(current, previous) {
        this.component = new Index({
          target: document.getElementById('app'),
          data: {
            name: 'world'
          }
        });
        console.log('Entered index!');
      },
      leave(current, previous) {
        this.component.destroy();
        console.log('Left index!');
      }
    }
  }
}

function fade ( node, ref ) {
	var delay = ref.delay; if ( delay === void 0 ) delay = 0;
	var duration = ref.duration; if ( duration === void 0 ) duration = 400;

	var o = +getComputedStyle( node ).opacity;

	return {
		delay: delay,
		duration: duration,
		css: function (t) { return ("opacity: " + (t * o)); }
	};
}

/* src\pages\authors\authors.html generated by Svelte v2.8.0 */

//import { startCase } from '../../utilities.js';

var methods$3 = {
  goto(path) {
    roadtrip.goto(path);
  }
};

function oncreate$1() {
  let right = document.getElementsByClassName('right')[0];
  if (right) console.log('GOT RIGHT');
  right.style.backgroundColor = '#f1ebda';
  right.style.backgroundImage = 'none';
  right.classList.remove('has-background-white-ter');
  
  let urly = './data/authors.json';
  fetch(urly).then(function(res) {
  return res.json() })
  .then( json => {
   
   
   store.set({authors: json});
 //  console.table(json)
			});
}
function store_1() {
	return store;
}

const file$3 = "src\\pages\\authors\\authors.html";

function create_main_fragment$3(component, ctx) {
	var div, h1, text, text_1, table, thead, tr, th, text_2, text_3, th_1, text_4, text_7, tbody;

	var if_block = (ctx.$authors && ctx.$authors.length > 0) && create_if_block(component, ctx);

	return {
		c: function create() {
			div = createElement("div");
			h1 = createElement("h1");
			text = createText("Shroud Discussion Authors");
			text_1 = createText("\r\n\r\n");
			table = createElement("table");
			thead = createElement("thead");
			tr = createElement("tr");
			th = createElement("th");
			text_2 = createText("name");
			text_3 = createText("\r\n\t\t");
			th_1 = createElement("th");
			text_4 = createText("number posts");
			text_7 = createText("\r\n\t\r\n\t");
			tbody = createElement("tbody");
			if (if_block) if_block.c();
			h1.className = "auth svelte-124qc1x";
			addLoc(h1, file$3, 1, 0, 38);
			addLoc(th, file$3, 6, 2, 138);
			addLoc(th_1, file$3, 7, 2, 155);
			addLoc(tr, file$3, 5, 3, 130);
			addLoc(thead, file$3, 4, 1, 118);
			tbody.id = "authors";
			addLoc(tbody, file$3, 16, 1, 286);
			table.className = "pure-table";
			addLoc(table, file$3, 3, 0, 89);
			div.className = "content is-medium home svelte-124qc1x";
			addLoc(div, file$3, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(h1, div);
			appendNode(text, h1);
			appendNode(text_1, div);
			appendNode(table, div);
			appendNode(thead, table);
			appendNode(tr, thead);
			appendNode(th, tr);
			appendNode(text_2, th);
			appendNode(text_3, tr);
			appendNode(th_1, tr);
			appendNode(text_4, th_1);
			appendNode(text_7, table);
			appendNode(tbody, table);
			if (if_block) if_block.m(tbody, null);
		},

		p: function update(changed, ctx) {
			if (ctx.$authors && ctx.$authors.length > 0) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block(component, ctx);
					if_block.c();
					if_block.m(tbody, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}

			if (if_block) if_block.d();
		}
	};
}

// (19:4) {#each $authors as author}
function create_each_block$1(component, ctx) {
	var tr, td, text_value = ctx.author.name, text, text_1, td_1, text_2_value = ctx.author.ct, text_2;

	var link_initial_data = { href: "/authors/" + ctx.author.name };
	var link = new Link({
		root: component.root,
		store: component.store,
		slots: { default: createFragment() },
		data: link_initial_data
	});

	return {
		c: function create() {
			tr = createElement("tr");
			td = createElement("td");
			text = createText(text_value);
			link._fragment.c();
			text_1 = createText("\r\n      ");
			td_1 = createElement("td");
			text_2 = createText(text_2_value);
			td.className = "svelte-124qc1x";
			addLoc(td, file$3, 20, 6, 399);
			td_1.className = "svelte-124qc1x";
			addLoc(td_1, file$3, 21, 6, 472);
			addLoc(tr, file$3, 19, 4, 387);
		},

		m: function mount(target, anchor) {
			insertNode(tr, target, anchor);
			appendNode(td, tr);
			appendNode(text, link._slotted.default);
			link._mount(td, null);
			appendNode(text_1, tr);
			appendNode(td_1, tr);
			appendNode(text_2, td_1);
		},

		p: function update(changed, ctx) {
			if ((changed.$authors) && text_value !== (text_value = ctx.author.name)) {
				text.data = text_value;
			}

			var link_changes = {};
			if (changed.$authors) link_changes.href = "/authors/" + ctx.author.name;
			link._set(link_changes);

			if ((changed.$authors) && text_2_value !== (text_2_value = ctx.author.ct)) {
				text_2.data = text_2_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(tr);
			}

			link.destroy();
		}
	};
}

// (18:4) {#if $authors && $authors.length > 0}
function create_if_block(component, ctx) {
	var each_anchor;

	var each_value = ctx.$authors;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(component, get_each_context$1(ctx, each_value, i));
	}

	return {
		c: function create() {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_anchor = createComment();
		},

		m: function mount(target, anchor) {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insertNode(each_anchor, target, anchor);
		},

		p: function update(changed, ctx) {
			if (changed.$authors) {
				each_value = ctx.$authors;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block$1(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_anchor.parentNode, each_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		d: function destroy$$1(detach) {
			destroyEach(each_blocks, detach);

			if (detach) {
				detachNode(each_anchor);
			}
		}
	};
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.author = list[i];
	child_ctx.each_value = list;
	child_ctx.author_index = i;
	return child_ctx;
}

function Authors(options) {
	this._debugName = '<Authors>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this.store = store_1();
	this._state = assign(this.store._init(["authors"]), options.data);
	this.store._add(this, ["authors"]);
	if (!('$authors' in this._state)) console.warn("<Authors> was created without expected data property '$authors'");
	this._intro = true;

	this._handlers.destroy = [removeFromStore];

	if (!options.root) {
		this._oncreate = [];
		this._beforecreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment$3(this, this._state);

	this.root._oncreate.push(() => {
		oncreate$1.call(this);
		this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
	});

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);

		this._lock = true;
		callAll(this._beforecreate);
		callAll(this._oncreate);
		callAll(this._aftercreate);
		this._lock = false;
	}
}

assign(Authors.prototype, protoDev);
assign(Authors.prototype, methods$3);

Authors.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

class AuthorsHandler {
  get route() {
    return {
      enter(current, previous) {
        this.component = new Authors({
          target: document.getElementById('app'),
          data: {
            name: 'world'
          }
        });
        console.log('Entered authors!');
      },
      leave(current, previous) {
        this.component.destroy();
        console.log('Left authors!');
      }
    }
  }
}

// Do not import this module to the application! Import index.js instead.

/**
 * @type {Toaster}
 */
let toaster = new Toaster();

/**
 * Toasts controller. Controls toasts that appear on the screen.
 * @constructor
 * @private
 */
function Toaster () {

    /**
     * @type {Toast[]}
     */
    this.toasts = [];

	/**
     * Keeps the timeouts of toasts which are removed.
	 * @type {Map}
	 */
	this.timeouts = new Map();

}

/**
 * @param {Toast} toast
 * @param {number} timeout
 */
Toaster.prototype.push = function (toast,cat, timeout) {
	
    requestAnimationFrame(() => {

        let height = toast.attach(0,cat);

        this.toasts.forEach((toast) => {
            toast.seek(height);
        });
		this.toasts.push(toast);
		// added for sticky modals
		if (timeout != 0) {
			this.timeouts.set(toast, setTimeout(() => this.remove(toast), timeout));
		}
		else {
			this.timeouts.set(toast, 0);		
		}

    });

};

/**
 * @param {Toast} toast
 */
Toaster.prototype.remove = function (toast) {

	if (this.timeouts.has(toast)) {
		clearTimeout(this.timeouts.get(toast));
		this.timeouts.delete(toast);
	} else {
		return; // already deleted
	}

	const index = this.toasts.indexOf(toast);
	const tst = this.toasts.splice(index, 1)[0];
	const height = toast.element.offsetHeight;

	tst.detach();
	this.toasts.slice(0, index).forEach(t => t.seek(-height));

};

Toaster.prototype.removeAll = function () {
	while (this.toasts.length > 0)
		this.remove(this.toasts[0]);
};

/* src\components\Input.html generated by Svelte v2.8.0 */

//on:click='fire("saveInput", { text_input })' 
function data$2() { 
  return { 
    text_input: ''
    } 
  }
const file$4 = "src\\components\\Input.html";

function create_main_fragment$4(component, ctx) {
	var div, input, input_updating = false, input_maxlength_value, text, button, text_1;

	function input_input_handler() {
		input_updating = true;
		component.set({ text_input: input.value });
		input_updating = false;
	}

	function click_handler(event) {
		component.fire("saveInput", { text_input: ctx.text_input });
	}

	return {
		c: function create() {
			div = createElement("div");
			input = createElement("input");
			text = createText("\r\n\r\n    ");
			button = createElement("button");
			text_1 = createText("save");
			addListener(input, "input", input_input_handler);
			input.id = "input_form";
			input.required = true;
			setAttribute(input, "type", "text");
			setAttribute(input, "minlength", "1");
			input.maxLength = input_maxlength_value = ctx.maxLength || 20;
			input.placeholder = ctx.placeholder;
			addLoc(input, file$4, 2, 2, 29);
			addListener(button, "click", click_handler);
			button.id = "input_btn";
			button.className = "pure-button";
			addLoc(button, file$4, 4, 4, 177);
			div.className = "pure-form";
			addLoc(div, file$4, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(input, div);

			input.value = ctx.text_input;

			appendNode(text, div);
			appendNode(button, div);
			appendNode(text_1, button);
		},

		p: function update(changed, _ctx) {
			ctx = _ctx;
			if (!input_updating) input.value = ctx.text_input;
			if ((changed.maxLength) && input_maxlength_value !== (input_maxlength_value = ctx.maxLength || 20)) {
				input.maxLength = input_maxlength_value;
			}

			if (changed.placeholder) {
				input.placeholder = ctx.placeholder;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}

			removeListener(input, "input", input_input_handler);
			removeListener(button, "click", click_handler);
		}
	};
}

function Input(options) {
	this._debugName = '<Input>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign(data$2(), options.data);
	if (!('text_input' in this._state)) console.warn("<Input> was created without expected data property 'text_input'");
	if (!('maxLength' in this._state)) console.warn("<Input> was created without expected data property 'maxLength'");
	if (!('placeholder' in this._state)) console.warn("<Input> was created without expected data property 'placeholder'");
	this._intro = true;

	this._fragment = create_main_fragment$4(this, this._state);

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(Input.prototype, protoDev);

Input.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

/* src\components\Buttons.html generated by Svelte v2.8.0 */

function data$3() { 
  return { 
    visible: true, isFullScreen: false 
    } 
  }
var methods$4 = {
      doIt(action,value){
         switch (action) {
             /* close the modal */
             case 'delete':
             //algo
             break;
             case 'cancel':
               deleteAllToasts();    
             break;             
             case 'ok':
               deleteAllToasts();
             break;
             case 'close': 
               deleteAllToasts();
             break;
             /* for reloading icons back to whatever the store has, minus colors */
      
         }
     }
  };

const file$5 = "src\\components\\Buttons.html";

function create_main_fragment$5(component, ctx) {
	var div, button, text, text_1;

	function click_handler(event) {
		component.doIt(ctx.action1);
	}

	var if_block = (ctx.btn2) && create_if_block$1(component, ctx);

	return {
		c: function create() {
			div = createElement("div");
			button = createElement("button");
			text = createText(ctx.btn1);
			text_1 = createText("\r\n    ");
			if (if_block) if_block.c();
			addListener(button, "click", click_handler);
			button.className = "pure-button pure-button svelte-p06i2w";
			addLoc(button, file$5, 15, 4, 326);
			div.className = "pure-g buttonHolder svelte-p06i2w";
			addLoc(div, file$5, 14, 0, 287);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(button, div);
			appendNode(text, button);
			appendNode(text_1, div);
			if (if_block) if_block.m(div, null);
		},

		p: function update(changed, _ctx) {
			ctx = _ctx;
			if (changed.btn1) {
				text.data = ctx.btn1;
			}

			if (ctx.btn2) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block$1(component, ctx);
					if_block.c();
					if_block.m(div, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}

			removeListener(button, "click", click_handler);
			if (if_block) if_block.d();
		}
	};
}

// (17:4) {#if btn2}
function create_if_block$1(component, ctx) {
	var button, text;

	function click_handler(event) {
		component.doIt(ctx.action2,ctx.value);
	}

	return {
		c: function create() {
			button = createElement("button");
			text = createText(ctx.btn2);
			addListener(button, "click", click_handler);
			button.className = "pure-button pure-button-primary svelte-p06i2w";
			addLoc(button, file$5, 17, 4, 428);
		},

		m: function mount(target, anchor) {
			insertNode(button, target, anchor);
			appendNode(text, button);
		},

		p: function update(changed, _ctx) {
			ctx = _ctx;
			if (changed.btn2) {
				text.data = ctx.btn2;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(button);
			}

			removeListener(button, "click", click_handler);
		}
	};
}

function Buttons(options) {
	this._debugName = '<Buttons>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this._state = assign(data$3(), options.data);
	if (!('action1' in this._state)) console.warn("<Buttons> was created without expected data property 'action1'");
	if (!('btn1' in this._state)) console.warn("<Buttons> was created without expected data property 'btn1'");
	if (!('btn2' in this._state)) console.warn("<Buttons> was created without expected data property 'btn2'");
	if (!('action2' in this._state)) console.warn("<Buttons> was created without expected data property 'action2'");
	if (!('value' in this._state)) console.warn("<Buttons> was created without expected data property 'value'");
	this._intro = true;

	this._fragment = create_main_fragment$5(this, this._state);

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);
	}
}

assign(Buttons.prototype, protoDev);
assign(Buttons.prototype, methods$4);

Buttons.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

/* here is how you can use this component!! 
                deleteAllToasts(); 
                let element = document.createElement("div"); 
                element.textContent = "Please enter a set name";
   //             let newToast = new Toast(element,'toast','toast-success'); //console.log('code is now ' + code)
   
                let newToast = new Toast(element,'modal','input',0); //console.log('code is now ' + code)
   
             //   element.parentNode.parentNode.addEventListener("click", () => newToast.delete()); // delete a toast on message click!
  
                element.addEventListener("click", () => newToast.delete()); // delete a toast on message click!
*/
const saveInput = (input, type) => {
    console.log('input is '+input);
    console.log('type is '+type);
    switch (type) {
        case 'note':
        let state = store.get();
        let obj = state.temp;
        let id = obj.id;
        obj.note = input;
        let bookmarks = localStorage.getItem('bookmarks') || {};
        bookmarks = JSON.parse(bookmarks);
        bookmarks[id] = obj;
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));	
        break;
    }
    deleteAllToasts();
};


Toast.TYPE = "toast"; // possible 'toast', 'modal', 'fullscreen'  => this becomes the className for the outer div
Toast.MODE = "info";  /* possible: => this is added to the classNames for the inner div

                            'toast info' - regular side served fading toast blue w/ info icon
                            'toast success' - regular side served fading toast green with success icon
                            'toast error' - regular side served fading toast red w/ error icon
                            'modal success' - modal middle fading success like windowise
                            'modal error' - modal middle fading error like windowise
                            'modal info' - modal middle, blue - info like windowise
                            'modal warning' - modal middle, yellow - warning like windowise
                            'modal input' - only for modal middle, orange - input like windowise

                            */

Toast.BUTTONS = []; // possible [], ['ok'], ['ok', 'cancel']

Toast.TIME_SHORT = 2000;
Toast.TIME_NORMAL = 4000;
Toast.TIME_LONG = 8000;
Toast.TIME_STICK = 0;
Toast.INPUT_TYPE = 'import_palette';

let options = {
	deleteDelay: 350,
    topOrigin: 0
};

/**
 * Delete all toast currently displayed.
 */
function deleteAllToasts () {
    return toaster.removeAll();
}

/**
 * On-screen toast message.
 * @param {string|Element} text - Message text.
 * @param {string} [mode] - Toast.MODE_*
 * @param {number} [timeout] - Toast.TIME_*
 * @constructor
 */
function Toast (text = `No text!`, type = Toast.TYPE, mode = Toast.MODE, timeout = Toast.TIME_SHORT, buttons = Toast.BUTTONS, input_type = Toast.INPUT_TYPE) {


    console.log('got yer toast, type: '+type + ' mode: '+mode);

    let el1 = document.createElement("div"),
        el2 = document.createElement("div"),
        el3 = document.createElement("div"), // added this for our text so we can adjust text/icons inline-block
        icon = document.createElement("div");
    
    if (type == 'modal') {
        var overlay = document.createElement("div"),
        wrapper = document.createElement("div");
        overlay.className = 'modal-overlay';
        wrapper.className = 'modal-wrapper animated zoomIn';
    }

    icon.className = type+'-icon-holder';
    el1.className = type;
    el2.className = `body ${type}-${mode}`;

    el1.appendChild(el2);
    el2.appendChild(el3);

    if (text instanceof Element) {
        el3.appendChild(text);
    } else {
	    el3.textContent = `${text}`;
    }
    el3.className = type+'-message noselect';

    let svg;
    let cat = mode;
    
    // add icons from windowise, when not fullscreen
    if (cat != 'fullscreen') {
      //console.log('addding svg for '+cat)
        svg = this.addicon(mode);
        icon.innerHTML = svg;
        el2.appendChild(icon);
    }
    else {
   // nada
    }
    
    if (type == 'modal') {
        document.body.appendChild(overlay);
        /* comment this out if you want to disable closing on click overlay */
        overlay.addEventListener("click", () => this.delete());      
        wrapper.appendChild(el1);
        this.element = wrapper;
    }
    else {
        this.element = el1;
    }

    /* this is how easy it is to add a Svelte component inside another es6 module... */

    if (cat == 'input') {
        var input;
        
    
            input = new Input({
                target: el2,
                data: {
                    placeholder: 'enter text',
                    maxLength: 20
                }
            });        
        input.on('saveInput', event => {
            saveInput(event.text_input,input_type);
        });
    }
    if (cat == 'fullscreen') {


    // fullscreen logic here

        let close = document.createElement("div");
        close.className = 'modal-close';
        close.addEventListener("click", () => this.delete());      
        el2.appendChild(close);
    }


 /* I added the 'value' attr so we could pass a value to the fn, like deleting a palette by name */
    if (type == 'modal' && cat == 'warning') {
        let val = buttons[1].value || false;
        let input = new Buttons({
         target: el2,
         data: {
             btn1: buttons[0].text,
             btn2: buttons[1].text,
             action1: buttons[0].action,
             action2: buttons[1].action,
             value: val
         }
        });
    }
    if (type == 'modal' && cat == 'error' && buttons.length>0) {
        var input = new Buttons({
            target: el2,
            data: {
                btn1: buttons[0].text,
                action1:buttons[0].action
            }
           });
    }

    this.position = 0;
    toaster.push(this, cat, timeout);
}

/**
 * Attaches toast to DOM and returns the height of the element.
 */
Toast.prototype.attach = function (position,cat) {
	
    this.position = position;
    this.updateVisualPosition(cat);
    document.body.appendChild(this.element);

    requestAnimationFrame(() => {
	    this.element.classList.add("displayed");
    });
    return this.element.offsetHeight;

};

/**
 * Seek the toast message by Y coordinate.
 * @param delta
 */
Toast.prototype.seek = function (delta) {

    this.position += delta;
    let cat = Toast.mode;
    /* I am not doing stacked toasts and it messes up my modals, so I am disabling this */
    this.updateVisualPosition(cat);

};

/**
 * @private
 */
Toast.prototype.updateVisualPosition = function (cat) {

    requestAnimationFrame(() => {
    /* add style, colors for mode. We could also adjust text or box-shadow here. */

  //  color: white;
  //  text-shadow: 0 0 1px black;
//  console.log('I got a cat of '+cat)
	let colors = {
		info: 'rgba(42, 128, 255, 0.95)', 
		warning: 'rgba(255, 183, 99, 0.95)',
		error: 'rgba(255, 86, 86, 0.95)',
        success: 'rgba(45, 193, 80, 0.95)',
        fullscreen: '#ffffff'
    };
    let text = {
        warning: '#3c4148f2'
    };
    colors.input = colors.info;


    var bod = this.element.getElementsByClassName('body')[0];
    bod.style.background =  colors[cat];
    
    if (cat == 'warning')  {
      bod.firstChild.style.color =  text[cat];
    }

        //   this.element.style.bottom = -options.topOrigin + this.position + "px";
    });

};

/**
 * Removes toast from DOM.
 */
Toast.prototype.detach = function () {

    let self = this;


    if (!this.element.parentNode) return;

    requestAnimationFrame(() => {
        this.element.classList.remove("displayed");
        this.element.classList.remove("zoomIn");
        this.element.classList.add("zoomOut");
    });
    setTimeout(() => {
        requestAnimationFrame(() => {
            if (!self.element || !self.element.parentNode)
                return;
            self.element.parentNode.removeChild(self.element);

            // added for modals, get rid of overlay too!
            let overlay = document.getElementsByClassName('modal-overlay')[0];

            if (overlay) {
                overlay.parentNode.removeChild(overlay);
            }   
       
        });
    }, options.deleteDelay);

};

Toast.prototype.delete = function () {

    toaster.remove(this);

};

Toast.prototype.addicon = function(mode) {

    let href = '';
    (mode == 'info') && (href = '#info-button');
    (mode == 'success') && (href = '#tick');
    (mode == 'error') && (href = '#cancel');
    (mode == 'input') && (href = '#danger');
    (mode == 'warning') && (href = '#danger');
  //  (mode == 'min') && (href = '#line');
  //  (mode == 'close') && (href = '#close');

    return '<svg class="toast-icon"><use xlink:href="'+href+'" /></svg>';
};

/* src\pages\notebook\notebook.html generated by Svelte v2.8.0 */

//import { startCase } from '../../utilities.js';

var methods$5 = {
  goto(path) {
    roadtrip.goto(path);
  }
};

function oncreate$2() {
  let bookmarks = localStorage.getItem('bookmarks');
  bookmarks = JSON.parse(bookmarks);
  console.log('bm: '+JSON.stringify(bookmarks));
  bookmarks = Object.entries(bookmarks);
  console.table(bookmarks);
  store.set({bookmarks, bookmarks});
  let right = document.getElementsByClassName('right')[0];
  if (right) console.log('GOT RIGHT');
  right.style.backgroundColor = '#f1ebda';
  right.style.backgroundImage = 'none';
  right.classList.remove('has-background-white-ter');
  
  
}
function store_1$1() {
	return store;
}

const file$6 = "src\\pages\\notebook\\notebook.html";

function create_main_fragment$6(component, ctx) {
	var div, h1, text, text_1, p, text_2, text_3, table, thead, tr, th, text_4, text_5, th_1, text_6, text_7, th_2, text_8, text_9, th_3, text_10, text_11, th_4, text_12, text_13, th_5, text_14, text_17, tbody;

	var if_block = (ctx.$bookmarks && ctx.$bookmarks.length > 0) && create_if_block$2(component, ctx);

	return {
		c: function create() {
			div = createElement("div");
			h1 = createElement("h1");
			text = createText("My Shroud Notebook");
			text_1 = createText("\r\n");
			p = createElement("p");
			text_2 = createText("As you read comments and check the resources included, you can build your own list of evidence which will be listed  here.");
			text_3 = createText("\r\n");
			table = createElement("table");
			thead = createElement("thead");
			tr = createElement("tr");
			th = createElement("th");
			text_4 = createText("pro or con");
			text_5 = createText("\r\n    ");
			th_1 = createElement("th");
			text_6 = createText("category");
			text_7 = createText("\r\n    ");
			th_2 = createElement("th");
			text_8 = createText("title");
			text_9 = createText("\r\n    ");
			th_3 = createElement("th");
			text_10 = createText("author");
			text_11 = createText("\r\n    ");
			th_4 = createElement("th");
			text_12 = createText("date");
			text_13 = createText("\r\n    ");
			th_5 = createElement("th");
			text_14 = createText("note");
			text_17 = createText("\r\n\t\r\n\t");
			tbody = createElement("tbody");
			if (if_block) if_block.c();
			h1.className = "auth svelte-124qc1x";
			addLoc(h1, file$6, 1, 0, 38);
			addLoc(p, file$6, 2, 0, 80);
			addLoc(th, file$6, 8, 4, 268);
			addLoc(th_1, file$6, 9, 4, 293);
			addLoc(th_2, file$6, 10, 4, 316);
			addLoc(th_3, file$6, 11, 4, 336);
			addLoc(th_4, file$6, 12, 4, 357);
			addLoc(th_5, file$6, 13, 4, 376);
			addLoc(tr, file$6, 6, 3, 256);
			addLoc(thead, file$6, 5, 1, 244);
			tbody.id = "authors";
			addLoc(tbody, file$6, 23, 1, 501);
			table.className = "pure-table";
			addLoc(table, file$6, 4, 0, 215);
			div.className = "content is-medium home svelte-124qc1x";
			addLoc(div, file$6, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(h1, div);
			appendNode(text, h1);
			appendNode(text_1, div);
			appendNode(p, div);
			appendNode(text_2, p);
			appendNode(text_3, div);
			appendNode(table, div);
			appendNode(thead, table);
			appendNode(tr, thead);
			appendNode(th, tr);
			appendNode(text_4, th);
			appendNode(text_5, tr);
			appendNode(th_1, tr);
			appendNode(text_6, th_1);
			appendNode(text_7, tr);
			appendNode(th_2, tr);
			appendNode(text_8, th_2);
			appendNode(text_9, tr);
			appendNode(th_3, tr);
			appendNode(text_10, th_3);
			appendNode(text_11, tr);
			appendNode(th_4, tr);
			appendNode(text_12, th_4);
			appendNode(text_13, tr);
			appendNode(th_5, tr);
			appendNode(text_14, th_5);
			appendNode(text_17, table);
			appendNode(tbody, table);
			if (if_block) if_block.m(tbody, null);
		},

		p: function update(changed, ctx) {
			if (ctx.$bookmarks && ctx.$bookmarks.length > 0) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block$2(component, ctx);
					if_block.c();
					if_block.m(tbody, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}

			if (if_block) if_block.d();
		}
	};
}

// (26:4) {#each $bookmarks as bookmark}
function create_each_block$2(component, ctx) {
	var tr, td, text_1, td_1, text_2_value = ctx.bookmark[1].cat, text_2, text_3, td_2, text_4_value = ctx.bookmark[1].title, text_4, text_5, p, text_6_value = ctx.bookmark[1].post, text_6, text_8, td_3, text_9_value = ctx.bookmark[1].author, text_9, text_10, td_4, text_11_value = ctx.bookmark[1].date, text_11, text_12, td_5;

	function select_block_type(ctx) {
		if (ctx.bookmark[1].type) return create_if_block_1;
		return create_if_block_2;
	}

	var current_block_type = select_block_type(ctx);
	var if_block = current_block_type(component, ctx);

	var link_initial_data = { href: "/authors/" + ctx.bookmark[1].author };
	var link = new Link({
		root: component.root,
		store: component.store,
		slots: { default: createFragment() },
		data: link_initial_data
	});

	function select_block_type_1(ctx) {
		if (ctx.bookmark[1].note) return create_if_block_3;
		return create_if_block_4;
	}

	var current_block_type_1 = select_block_type_1(ctx);
	var if_block_1 = current_block_type_1(component, ctx);

	return {
		c: function create() {
			tr = createElement("tr");
			td = createElement("td");
			if_block.c();
			text_1 = createText("\r\n        ");
			td_1 = createElement("td");
			text_2 = createText(text_2_value);
			text_3 = createText("\r\n        ");
			td_2 = createElement("td");
			text_4 = createText(text_4_value);
			text_5 = createText("\r\n          ");
			p = createElement("p");
			text_6 = createText(text_6_value);
			text_8 = createText("\r\n      ");
			td_3 = createElement("td");
			text_9 = createText(text_9_value);
			link._fragment.c();
			text_10 = createText("\r\n      ");
			td_4 = createElement("td");
			text_11 = createText(text_11_value);
			text_12 = createText("\r\n\r\n      ");
			td_5 = createElement("td");
			if_block_1.c();
			td.className = "svelte-124qc1x";
			addLoc(td, file$6, 27, 8, 624);
			td_1.className = "svelte-124qc1x";
			addLoc(td_1, file$6, 34, 8, 838);
			p.className = "postTruncate";
			addLoc(p, file$6, 36, 10, 909);
			td_2.className = "svelte-124qc1x";
			addLoc(td_2, file$6, 35, 8, 874);
			td_3.className = "svelte-124qc1x";
			addLoc(td_3, file$6, 38, 6, 978);
			td_4.className = "svelte-124qc1x";
			addLoc(td_4, file$6, 39, 6, 1065);
			td_5.className = "svelte-124qc1x";
			addLoc(td_5, file$6, 41, 6, 1102);
			addLoc(tr, file$6, 26, 4, 610);
		},

		m: function mount(target, anchor) {
			insertNode(tr, target, anchor);
			appendNode(td, tr);
			if_block.m(td, null);
			appendNode(text_1, tr);
			appendNode(td_1, tr);
			appendNode(text_2, td_1);
			appendNode(text_3, tr);
			appendNode(td_2, tr);
			appendNode(text_4, td_2);
			appendNode(text_5, td_2);
			appendNode(p, td_2);
			appendNode(text_6, p);
			appendNode(text_8, tr);
			appendNode(td_3, tr);
			appendNode(text_9, link._slotted.default);
			link._mount(td_3, null);
			appendNode(text_10, tr);
			appendNode(td_4, tr);
			appendNode(text_11, td_4);
			appendNode(text_12, tr);
			appendNode(td_5, tr);
			if_block_1.m(td_5, null);
		},

		p: function update(changed, ctx) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(changed, ctx);
			} else {
				if_block.d(1);
				if_block = current_block_type(component, ctx);
				if_block.c();
				if_block.m(td, null);
			}

			if ((changed.$bookmarks) && text_2_value !== (text_2_value = ctx.bookmark[1].cat)) {
				text_2.data = text_2_value;
			}

			if ((changed.$bookmarks) && text_4_value !== (text_4_value = ctx.bookmark[1].title)) {
				text_4.data = text_4_value;
			}

			if ((changed.$bookmarks) && text_6_value !== (text_6_value = ctx.bookmark[1].post)) {
				text_6.data = text_6_value;
			}

			if ((changed.$bookmarks) && text_9_value !== (text_9_value = ctx.bookmark[1].author)) {
				text_9.data = text_9_value;
			}

			var link_changes = {};
			if (changed.$bookmarks) link_changes.href = "/authors/" + ctx.bookmark[1].author;
			link._set(link_changes);

			if ((changed.$bookmarks) && text_11_value !== (text_11_value = ctx.bookmark[1].date)) {
				text_11.data = text_11_value;
			}

			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block_1) {
				if_block_1.p(changed, ctx);
			} else {
				if_block_1.d(1);
				if_block_1 = current_block_type_1(component, ctx);
				if_block_1.c();
				if_block_1.m(td_5, null);
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(tr);
			}

			if_block.d();
			link.destroy();
			if_block_1.d();
		}
	};
}

// (29:10) {#if bookmark[1].type}
function create_if_block_1(component, ctx) {
	var span, text_value = ctx.bookmark[1].type, text, span_class_value;

	return {
		c: function create() {
			span = createElement("span");
			text = createText(text_value);
			span.className = span_class_value = "tb_" + ctx.bookmark[1].type + " tb_buttons" + " svelte-124qc1x";
			addLoc(span, file$6, 29, 10, 674);
		},

		m: function mount(target, anchor) {
			insertNode(span, target, anchor);
			appendNode(text, span);
		},

		p: function update(changed, ctx) {
			if ((changed.$bookmarks) && text_value !== (text_value = ctx.bookmark[1].type)) {
				text.data = text_value;
			}

			if ((changed.$bookmarks) && span_class_value !== (span_class_value = "tb_" + ctx.bookmark[1].type + " tb_buttons" + " svelte-124qc1x")) {
				span.className = span_class_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(span);
			}
		}
	};
}

// (31:10) {:else}
function create_if_block_2(component, ctx) {
	var span, text;

	return {
		c: function create() {
			span = createElement("span");
			text = createText("choose");
			addLoc(span, file$6, 31, 10, 777);
		},

		m: function mount(target, anchor) {
			insertNode(span, target, anchor);
			appendNode(text, span);
		},

		p: noop,

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(span);
			}
		}
	};
}

// (43:10) {#if bookmark[1].note}
function create_if_block_3(component, ctx) {
	var text_value = ctx.bookmark[1].note, text;

	return {
		c: function create() {
			text = createText(text_value);
		},

		m: function mount(target, anchor) {
			insertNode(text, target, anchor);
		},

		p: function update(changed, ctx) {
			if ((changed.$bookmarks) && text_value !== (text_value = ctx.bookmark[1].note)) {
				text.data = text_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(text);
			}
		}
	};
}

// (45:10) {:else}
function create_if_block_4(component, ctx) {
	var span, text;

	return {
		c: function create() {
			span = createElement("span");
			text = createText("add");
			span.className = "tb_note tb_buttons";
			addLoc(span, file$6, 45, 10, 1202);
		},

		m: function mount(target, anchor) {
			insertNode(span, target, anchor);
			appendNode(text, span);
		},

		p: noop,

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(span);
			}
		}
	};
}

// (25:4) {#if $bookmarks && $bookmarks.length > 0}
function create_if_block$2(component, ctx) {
	var each_anchor;

	var each_value = ctx.$bookmarks;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(component, get_each_context$2(ctx, each_value, i));
	}

	return {
		c: function create() {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_anchor = createComment();
		},

		m: function mount(target, anchor) {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insertNode(each_anchor, target, anchor);
		},

		p: function update(changed, ctx) {
			if (changed.$bookmarks) {
				each_value = ctx.$bookmarks;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block$2(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_anchor.parentNode, each_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		d: function destroy$$1(detach) {
			destroyEach(each_blocks, detach);

			if (detach) {
				detachNode(each_anchor);
			}
		}
	};
}

function get_each_context$2(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.bookmark = list[i];
	child_ctx.each_value = list;
	child_ctx.bookmark_index = i;
	return child_ctx;
}

function Notebook(options) {
	this._debugName = '<Notebook>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this.store = store_1$1();
	this._state = assign(this.store._init(["bookmarks"]), options.data);
	this.store._add(this, ["bookmarks"]);
	if (!('$bookmarks' in this._state)) console.warn("<Notebook> was created without expected data property '$bookmarks'");
	this._intro = true;

	this._handlers.destroy = [removeFromStore];

	if (!options.root) {
		this._oncreate = [];
		this._beforecreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment$6(this, this._state);

	this.root._oncreate.push(() => {
		oncreate$2.call(this);
		this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
	});

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);

		this._lock = true;
		callAll(this._beforecreate);
		callAll(this._oncreate);
		callAll(this._aftercreate);
		this._lock = false;
	}
}

assign(Notebook.prototype, protoDev);
assign(Notebook.prototype, methods$5);

Notebook.prototype._checkReadOnly = function _checkReadOnly(newState) {
};

class NotebookHandler {
  get route() {
    return {
      enter(current, previous) {
        this.component = new Notebook ({
          target: document.getElementById('app'),
          data: {
            name: 'world'
          }
        });
        console.log('Entered notebook!');
      },
      leave(current, previous) {
        this.component.destroy();
        console.log('Left notebook!');
      }
    }
  }
}

Array.prototype.diff = function (a) {
    return this.filter(function (i) {
      return a.indexOf(i) < 0;
    });
  };
  const startCase = (str) => {
    return str.split(' ')
    .map(w => w[0].toUpperCase() + w.substr(1).toLowerCase())
    .join(' ');	
  };

/* src\pages\author-details\author-details.html generated by Svelte v2.8.0 */

function author_name({ $id }) {
let name = $id.replace(/_/g, ' ');
	name = startCase(name);
return name 
}

var methods$6 = {
		moveTo(id) {
			let elmnt = document.getElementById(id);
			elmnt.scrollIntoView();	
		},
		saveData(type,cat,post, x) {
			let str = cat;
			// new Toast(str, 'modal','error', 0,[
			// 		{ text:'ok', action:'cancel'}])
			// 		return
			/* the x ties us to the index, which I don't like, but I don't see any other way right now
			as there are no unique ids accross the 3 blogs - stephen jones has no ids for comments. So basically this is lame and we can now only hide crap we may want to delete later, because it would screw up the index for everything saved to notebook
			*/
			let bookmarks = localStorage.getItem('bookmarks') || {};
			if (Object.keys(bookmarks).length > 0) bookmarks = JSON.parse(bookmarks);

			console.log(x+ ' cat is '+cat);
			console.log(x+ ' author is '+post.author);
			let id = `${post.author}_${cat}_${x}`;
			let st;
			
			let obj = {
				id: id,
				cat: cat,
				title: post.title,
				post: post.post,
				author: post.author,
				url: post.url,
				date:post.date
			};
			
			if (bookmarks[id] && bookmarks[id].note) obj.note = bookmarks[id].note;

			switch (type) {
				case 'pro':
					obj.type = 'pro';				
					bookmarks[id] = obj;
					localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
					 st = 'saved '+post.title+ ' to notebook as supporting authenticity.';
					new Toast(st,'toast','success');
					break;
				case 'con':
					obj.type = 'con';				
					bookmarks[id] = obj;
					localStorage.setItem('bookmarks', JSON.stringify(bookmarks));					
					st = 'saved '+post.title+ ' to notebook as evidence against authenticity.';
					new Toast(st,'toast','error');
					break;			

				case 'note':
				    st = 'Enter or paste text:';
				    store.set({temp:obj});
					new Toast(str, 'modal', 'input', 0, [], 'note');
					break;
			}
		},
		addParagraphBreaks() {
			let comp = this;
			let postings = document.getElementsByClassName('posting');
			//console.log('got postings? '+postings)
			let j = 0;

			const authorsArr  = ['david', 'hugh', 'dan', 'colin', 'yannick', 'charles', 'daveb', 'max', 'stephen', 'mario', 'mark', 'antonio', 'john', 'giulio', 'louis', 'anoxie', 'dave', 'kelly', 'barry', 'barrie', 'russ', 'joe', 'colinsberry', 'ron'];
			const scholars = ['barbet','rucker','zugibe', 'wesselow', 'piczak', 'piczek', 'benford','vignon', 'bucklin', 'marino','rolfe', 'meacham', 'fanti', 'rogers', 'adler', 'heller', 'mccrone', 'jackson', 'strup', 'enea'];
			const shroudWords = ['pray', 'codex', 'tomb', 'cloth', 'textile', 'shroud', 'woven', 'ancient', 'formation', 'pollen', 'dna'];
			const bloodWords = ['blood', 'bloodstains', 'bloodstain', 'bloody', 'wounds'];
			const holyWords = ['christ', 'yeshua','jesus', 'god', 'holy', 'spirit', 'trinity', 'lord', 'lords'];
			alterPost(j);
			
			
			function alterPost(j) { 
				if (j > postings.length-1) return
//			for (let posting of postings) {
	
				let str = postings[j].textContent.replace(/\\n/g, '');

				let words = str.split(' ');
			
				//let result = this.chunkArray(str, 50);
				let newStr = '';
				let lines = [];

				let i = 0; // for lines
				let e = 0; // for words
		
				
				for (let word of words) {
					// fix people like Charles Freeman who are always adding commas w/ no space after them...
					word = word.replace(/,[s]*/g, ", ");

					let line = lines[i] || '';	
					//console.log(word)
					if (authorsArr.includes(word.trim().toLowerCase().replace('-','').replace('“', '').replace(',', '').replace('.', ''))) {
						word = '<span class="authorName">'+word+'</span>';
					}
					if (scholars.includes(word.trim().toLowerCase().replace('“', '').replace('’s', '').replace(',', '').replace('.', ''))) {
						word = '<span class="scholars">'+word+'</span>';
					}


					if (bloodWords.includes(word.trim().toLowerCase().replace('“', '').replace(',', '').replace('.', ''))) {
						word = '<span class="blood">'+word+'</span>';
					}

					if (shroudWords.includes(word.trim().toLowerCase().replace('“', '').replace(',', '').replace('.', ''))) {
						word = '<span class="shroud">'+word+'</span>';
					}
	
					if (holyWords.includes(word.trim().toLowerCase().replace('“', '').replace(',', '').replace('.', '').replace('’s', ''))) {
						word = '<span class="holy">'+word+'</span>';
					}				

					line = line + ' ' + word;
					lines[i] = line;
					e++;
					if (e > 50 && word.includes('.') || e > 50 && word.includes('!')) {
						e = 0;
						//console.log("\n\nGOT A HIT")
						i++;
					}
				}
				for (let line of lines) {
					//console.log(line)
					line = comp.urlify(line);
					newStr = newStr + '<p>'+line+'</p>';
				}
				postings[j].innerHTML =  newStr;
				j++;
				setTimeout(() => {
					alterPost(j);
				}, 50);
			
			}
		},
		urlify(text) {
			let urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
			//var urlRegex = /(https?:\/\/[^\s]+)/g;
			return text.replace(urlRegex, function(url,b,c) {
			
			let url2 = (c == 'www.') ?  'http://' +url : url;
				url2 = url2.replace(')', '').replace('(', '');
			
				return '<a href="' +url2.toLowerCase()+ '" target="_blank">' + url.toLowerCase() + '</a>';
			}) 
		},
		chunkArray(myArray, chunk_size){
			var arrayLength = myArray.length;
			var tempArray = [];

			for (let index = 0; index < arrayLength; index += chunk_size) {
		
				let myChunk = myArray.slice(index, index+chunk_size);
				// Do something if you want with the group
				
				tempArray.push(myChunk);
			}

			return tempArray;
		}
};

function oncreate$3() {
	let right = document.getElementsByClassName('right')[0];
      if (right) console.log('GOT RIGHT');
      right.style.backgroundColor = '#f1ebda';
      right.style.backgroundImage = 'none';
      right.classList.remove('has-background-white-ter');
	const state = store.get();
	const id = state.id;
	console.log('dawg id is '+id);
	console.log('id is '+id);

	const comp = this;

	const urly = `../data/authors_master/${ id }.json`;
	return fetch(urly).then(function(res) {
	return res.json();
		})
		.then(function(json) {
		let arr = [];
	     for (let cat in json) {
			 arr.push({name: cat, len: json[cat].length, data:json[cat]});
		 }
		 setTimeout(() => {
		   console.log('adding Par.breaks');
			comp.addParagraphBreaks();
			//comp.shortenDates();
			for (let cat in json) {
				new Tablesort(document.getElementById(cat));
			}
		}, 2000);
		store.set({author: {name: id, cats: arr} });

		});

	}
function store_1$2() {
	return store;
}

const file$7 = "src\\pages\\author-details\\author-details.html";

function create_main_fragment$7(component, ctx) {
	var div, h1, text, text_1, table, thead, tr, th, text_2, text_3, th_1, text_4, text_7, tbody, text_10, div_transition, current;

	var if_block = (ctx.$author && ctx.$author.cats) && create_if_block$3(component, ctx);

	var if_block_1 = (ctx.$author && ctx.$author.cats) && create_if_block_1$1(component, ctx);

	return {
		c: function create() {
			div = createElement("div");
			h1 = createElement("h1");
			text = createText(ctx.author_name);
			text_1 = createText("\r\n\r\n ");
			table = createElement("table");
			thead = createElement("thead");
			tr = createElement("tr");
			th = createElement("th");
			text_2 = createText("category");
			text_3 = createText("\r\n\t\t\t");
			th_1 = createElement("th");
			text_4 = createText("number posts");
			text_7 = createText("\r\n\t\t\r\n\t\t");
			tbody = createElement("tbody");
			if (if_block) if_block.c();
			text_10 = createText("\r\n\r\n\t");
			if (if_block_1) if_block_1.c();
			h1.className = "svelte-vbobyl";
			addLoc(h1, file$7, 1, 1, 64);
			addLoc(th, file$7, 6, 3, 143);
			addLoc(th_1, file$7, 7, 3, 165);
			addLoc(tr, file$7, 5, 4, 134);
			addLoc(thead, file$7, 4, 2, 121);
			tbody.id = "categories";
			addLoc(tbody, file$7, 16, 2, 305);
			table.className = "pure-table";
			addLoc(table, file$7, 3, 1, 91);
			div.id = "postWrap";
			div.className = "content is-medium svelte-vbobyl";
			addLoc(div, file$7, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			appendNode(h1, div);
			appendNode(text, h1);
			appendNode(text_1, div);
			appendNode(table, div);
			appendNode(thead, table);
			appendNode(tr, thead);
			appendNode(th, tr);
			appendNode(text_2, th);
			appendNode(text_3, tr);
			appendNode(th_1, tr);
			appendNode(text_4, th_1);
			appendNode(text_7, table);
			appendNode(tbody, table);
			if (if_block) if_block.m(tbody, null);
			appendNode(text_10, div);
			if (if_block_1) if_block_1.m(div, null);
			current = true;
		},

		p: function update(changed, ctx) {
			if (!current || changed.author_name) {
				text.data = ctx.author_name;
			}

			if (ctx.$author && ctx.$author.cats) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block$3(component, ctx);
					if_block.c();
					if_block.m(tbody, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (ctx.$author && ctx.$author.cats) {
				if (if_block_1) {
					if_block_1.p(changed, ctx);
				} else {
					if_block_1 = create_if_block_1$1(component, ctx);
					if_block_1.c();
					if_block_1.m(div, null);
				}
			} else if (if_block_1) {
				if_block_1.d(1);
				if_block_1 = null;
			}
		},

		i: function intro(target, anchor) {
			if (current) return;
			if (component.root._intro) {
				if (div_transition) div_transition.invalidate();

				component.root._aftercreate.push(() => {
					if (!div_transition) div_transition = wrapTransition(component, div, fade, {}, true);
					div_transition.run(1);
				});
			}
			this.m(target, anchor);
		},

		o: function outro(outrocallback) {
			if (!current) return;

			if (!div_transition) div_transition = wrapTransition(component, div, fade, {}, false);
			div_transition.run(0, () => {
				outrocallback();
				div_transition = null;
			});

			current = false;
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}

			if (if_block) if_block.d();
			if (if_block_1) if_block_1.d();
		}
	};
}

// (19:2) {#each $author.cats as cat}
function create_each_block$3(component, ctx) {
	var tr, td, text_value = ctx.cat.name, text, text_1, td_1, text_2_value = ctx.cat.len, text_2;

	return {
		c: function create() {
			tr = createElement("tr");
			td = createElement("td");
			text = createText(text_value);
			text_1 = createText("\r\n\t\t  ");
			td_1 = createElement("td");
			text_2 = createText(text_2_value);
			td._svelte = { component, ctx };

			addListener(td, "click", click_handler);
			td.className = "linky svelte-vbobyl";
			addLoc(td, file$7, 20, 4, 406);
			td_1.className = "svelte-vbobyl";
			addLoc(td_1, file$7, 21, 4, 473);
			addLoc(tr, file$7, 19, 2, 396);
		},

		m: function mount(target, anchor) {
			insertNode(tr, target, anchor);
			appendNode(td, tr);
			appendNode(text, td);
			appendNode(text_1, tr);
			appendNode(td_1, tr);
			appendNode(text_2, td_1);
		},

		p: function update(changed, ctx) {
			if ((changed.$author) && text_value !== (text_value = ctx.cat.name)) {
				text.data = text_value;
			}

			td._svelte.ctx = ctx;
			if ((changed.$author) && text_2_value !== (text_2_value = ctx.cat.len)) {
				text_2.data = text_2_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(tr);
			}

			removeListener(td, "click", click_handler);
		}
	};
}

// (18:2) {#if $author && $author.cats}
function create_if_block$3(component, ctx) {
	var each_anchor;

	var each_value = ctx.$author.cats;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$3(component, get_each_context$3(ctx, each_value, i));
	}

	return {
		c: function create() {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_anchor = createComment();
		},

		m: function mount(target, anchor) {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insertNode(each_anchor, target, anchor);
		},

		p: function update(changed, ctx) {
			if (changed.$author) {
				each_value = ctx.$author.cats;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$3(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block$3(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_anchor.parentNode, each_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		d: function destroy$$1(detach) {
			destroyEach(each_blocks, detach);

			if (detach) {
				detachNode(each_anchor);
			}
		}
	};
}

// (30:0) {#each $author.cats as cat}
function create_each_block_1(component, ctx) {
	var table, thead, tr, th, text, text_1, th_1, text_2, text_5, tbody, table_id_value;

	var each_value_2 = ctx.cat.data;

	var each_blocks = [];

	for (var i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(component, get_each_context_2(ctx, each_value_2, i));
	}

	return {
		c: function create() {
			table = createElement("table");
			thead = createElement("thead");
			tr = createElement("tr");
			th = createElement("th");
			text = createText("post");
			text_1 = createText("\r\n\t\t\t\t");
			th_1 = createElement("th");
			text_2 = createText("date");
			text_5 = createText("\r\n\t\t\t\r\n\t\t\t");
			tbody = createElement("tbody");

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
			addLoc(th, file$7, 34, 4, 687);
			setAttribute(th_1, "width", "250");
			addLoc(th_1, file$7, 35, 4, 707);
			addLoc(tr, file$7, 32, 5, 672);
			addLoc(thead, file$7, 31, 3, 658);
			tbody.id = "posts";
			addLoc(tbody, file$7, 44, 3, 858);
			table.id = table_id_value = ctx.cat.name;
			table.className = "pure-table svelte-vbobyl";
			addLoc(table, file$7, 30, 1, 611);
		},

		m: function mount(target, anchor) {
			insertNode(table, target, anchor);
			appendNode(thead, table);
			appendNode(tr, thead);
			appendNode(th, tr);
			appendNode(text, th);
			appendNode(text_1, tr);
			appendNode(th_1, tr);
			appendNode(text_2, th_1);
			appendNode(text_5, table);
			appendNode(tbody, table);

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}
		},

		p: function update(changed, ctx) {
			if (changed.$author) {
				each_value_2 = ctx.cat.data;

				for (var i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block_2(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(tbody, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value_2.length;
			}

			if ((changed.$author) && table_id_value !== (table_id_value = ctx.cat.name)) {
				table.id = table_id_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(table);
			}

			destroyEach(each_blocks, detach);
		}
	};
}

// (47:3) {#each cat.data as post, x}
function create_each_block_2(component, ctx) {
	var tr, td, p, text, text_1_value = ctx.cat.name, text_1, text_2, span, a, text_3_value = ctx.post.title, text_3, a_href_value, span_1, span_2, text_4, text_6, p_1, span_3, text_7, span_4, text_8, span_5, text_9, text_11, p_2, text_12_value = ctx.post.post, text_12, text_15, td_1, text_16_value = ctx.post.date, text_16, span_6, text_17_value = ctx.post.mins, text_17, span_7;

	return {
		c: function create() {
			tr = createElement("tr");
			td = createElement("td");
			p = createElement("p");
			text = createText("/");
			text_1 = createText(text_1_value);
			text_2 = createText("/    article: ");
			span = createElement("span");
			a = createElement("a");
			text_3 = createText(text_3_value);
			span_1 = createElement("span");
			span_2 = createElement("span");
			text_4 = createText("↑ top");
			text_6 = createText("\r\n\t\t\t\t");
			p_1 = createElement("p");
			span_3 = createElement("span");
			text_7 = createText("pro");
			span_4 = createElement("span");
			text_8 = createText("con");
			span_5 = createElement("span");
			text_9 = createText("add note");
			text_11 = createText("\r\n\t\t\t\t");
			p_2 = createElement("p");
			text_12 = createText(text_12_value);
			text_15 = createText("\r\n\t\t\t  ");
			td_1 = createElement("td");
			text_16 = createText(text_16_value);
			span_6 = createElement("span");
			text_17 = createText(text_17_value);
			span_7 = createElement("span");
			a.href = a_href_value = "" + ctx.post.url + (ctx.post.id ? `#${ctx.post.id}` : '');
			a.target = "_blank";
			addLoc(a, file$7, 50, 55, 995);

			span_2._svelte = { component };

			addListener(span_2, "click", click_handler_1);
			span_2.className = "pull-right";
			addLoc(span_2, file$7, 50, 144, 1084);
			addLoc(span_1, file$7, 50, 138, 1078);
			addLoc(span, file$7, 50, 49, 989);
			p.className = "postInfo";
			addLoc(p, file$7, 50, 4, 944);

			span_3._svelte = { component, ctx };

			addListener(span_3, "click", click_handler_2);
			span_3.className = "tb_pro";
			addLoc(span_3, file$7, 53, 5, 1193);

			span_4._svelte = { component, ctx };

			addListener(span_4, "click", click_handler_3);
			span_4.className = "tb_con";
			addLoc(span_4, file$7, 53, 80, 1268);

			span_5._svelte = { component, ctx };

			addListener(span_5, "click", click_handler_4);
			span_5.className = "tb_note";
			addLoc(span_5, file$7, 53, 155, 1343);
			p_1.className = "toolbar";
			addLoc(p_1, file$7, 52, 4, 1167);
			p_2.className = "posting svelte-vbobyl";
			addLoc(p_2, file$7, 55, 4, 1441);
			td.className = "svelte-vbobyl";
			addLoc(td, file$7, 49, 5, 933);
			addLoc(span_7, file$7, 59, 66, 1566);
			span_6.className = "right10";
			addLoc(span_6, file$7, 59, 33, 1533);
			td_1.className = "date svelte-vbobyl";
			addLoc(td_1, file$7, 59, 5, 1505);
			addLoc(tr, file$7, 47, 3, 916);
		},

		m: function mount(target, anchor) {
			insertNode(tr, target, anchor);
			appendNode(td, tr);
			appendNode(p, td);
			appendNode(text, p);
			appendNode(text_1, p);
			appendNode(text_2, p);
			appendNode(span, p);
			appendNode(a, span);
			appendNode(text_3, a);
			appendNode(span_1, span);
			appendNode(span_2, span_1);
			appendNode(text_4, span_2);
			appendNode(text_6, td);
			appendNode(p_1, td);
			appendNode(span_3, p_1);
			appendNode(text_7, span_3);
			appendNode(span_4, p_1);
			appendNode(text_8, span_4);
			appendNode(span_5, p_1);
			appendNode(text_9, span_5);
			appendNode(text_11, td);
			appendNode(p_2, td);
			appendNode(text_12, p_2);
			appendNode(text_15, tr);
			appendNode(td_1, tr);
			appendNode(text_16, td_1);
			appendNode(span_6, td_1);
			appendNode(text_17, span_6);
			appendNode(span_7, span_6);
		},

		p: function update(changed, ctx) {
			if ((changed.$author) && text_1_value !== (text_1_value = ctx.cat.name)) {
				text_1.data = text_1_value;
			}

			if ((changed.$author) && text_3_value !== (text_3_value = ctx.post.title)) {
				text_3.data = text_3_value;
			}

			if ((changed.$author) && a_href_value !== (a_href_value = "" + ctx.post.url + (ctx.post.id ? `#${ctx.post.id}` : ''))) {
				a.href = a_href_value;
			}

			span_3._svelte.ctx = ctx;
			span_4._svelte.ctx = ctx;
			span_5._svelte.ctx = ctx;
			if ((changed.$author) && text_12_value !== (text_12_value = ctx.post.post)) {
				text_12.data = text_12_value;
			}

			if ((changed.$author) && text_16_value !== (text_16_value = ctx.post.date)) {
				text_16.data = text_16_value;
			}

			if ((changed.$author) && text_17_value !== (text_17_value = ctx.post.mins)) {
				text_17.data = text_17_value;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(tr);
			}

			removeListener(span_2, "click", click_handler_1);
			removeListener(span_3, "click", click_handler_2);
			removeListener(span_4, "click", click_handler_3);
			removeListener(span_5, "click", click_handler_4);
		}
	};
}

// (29:1) {#if $author && $author.cats}
function create_if_block_1$1(component, ctx) {
	var each_anchor;

	var each_value_1 = ctx.$author.cats;

	var each_blocks = [];

	for (var i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(component, get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c: function create() {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_anchor = createComment();
		},

		m: function mount(target, anchor) {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insertNode(each_anchor, target, anchor);
		},

		p: function update(changed, ctx) {
			if (changed.$author) {
				each_value_1 = ctx.$author.cats;

				for (var i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block_1(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_anchor.parentNode, each_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value_1.length;
			}
		},

		d: function destroy$$1(detach) {
			destroyEach(each_blocks, detach);

			if (detach) {
				detachNode(each_anchor);
			}
		}
	};
}

function get_each_context$3(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.cat = list[i];
	child_ctx.each_value = list;
	child_ctx.cat_index = i;
	return child_ctx;
}

function click_handler(event) {
	const { component, ctx } = this._svelte;

	component.moveTo(ctx.cat.name);
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.cat = list[i];
	child_ctx.each_value_1 = list;
	child_ctx.cat_index_1 = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.post = list[i];
	child_ctx.each_value_2 = list;
	child_ctx.x = i;
	return child_ctx;
}

function click_handler_1(event) {
	const { component } = this._svelte;

	component.moveTo('postWrap');
}

function click_handler_2(event) {
	const { component, ctx } = this._svelte;

	component.saveData('pro',ctx.cat.name, ctx.post,ctx.x);
}

function click_handler_3(event) {
	const { component, ctx } = this._svelte;

	component.saveData('con',ctx.cat.name, ctx.post,ctx.x);
}

function click_handler_4(event) {
	const { component, ctx } = this._svelte;

	component.saveData('note',ctx.cat.name, ctx.post,ctx.x);
}

function Author_details(options) {
	this._debugName = '<Author_details>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this.store = store_1$2();
	this._state = assign(this.store._init(["id","author"]), options.data);
	this.store._add(this, ["id","author"]);
	this._recompute({ $id: 1 }, this._state);
	if (!('$id' in this._state)) console.warn("<Author_details> was created without expected data property '$id'");

	if (!('$author' in this._state)) console.warn("<Author_details> was created without expected data property '$author'");
	this._intro = true;

	this._handlers.destroy = [removeFromStore];

	if (!options.root) {
		this._oncreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment$7(this, this._state);

	this.root._oncreate.push(() => {
		oncreate$3.call(this);
		this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
	});

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);

		callAll(this._oncreate);
		callAll(this._aftercreate);
	}
}

assign(Author_details.prototype, protoDev);
assign(Author_details.prototype, methods$6);

Author_details.prototype._checkReadOnly = function _checkReadOnly(newState) {
	if ('author_name' in newState && !this._updatingReadonlyProperty) throw new Error("<Author_details>: Cannot set read-only property 'author_name'");
};

Author_details.prototype._recompute = function _recompute(changed, state) {
	if (changed.$id) {
		if (this._differs(state.author_name, (state.author_name = author_name(state)))) changed.author_name = true;
	}
};

class AuthorDetailsHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
     
      },

      enter(current, previous) {
      //  console.log('the details route params are '+JSON.stringify(current.params))
        store.set({id: current.params.id});
    
        this.component = new Author_details({
          target: document.getElementById('app'),
          data: {
   
          }
        });
       // console.log('Entered post details!');
      },
      leave(current, previous) {
        this.component.destroy();
      //  console.log('Left post details!');
      }
    }
  }
}

/* src\pages\post-details\post-details.html generated by Svelte v2.8.0 */

function colors({ $sectionColors, $id }) {
	return $sectionColors[$id]
}

function snips({ $snippets, $id }) {
        /* could not figure out how to chaing these ! :(  */
	  $snippets.map((snip,idx) => { 
		snip.idx = idx;
	  });
	  return $snippets.filter((snip,idx) => snip.cat === $id);
}

function details({ $id, $cats }) {
 return $cats.filter(category => category[0] === $id)[0];
}

var methods$7 = {
		scrollTag(id) {
			const elmnt = document.getElementById(id);
			elmnt.scrollIntoView();	
		},
		addH2Tags() {
			const lesson = document.getElementsByClassName('lesson')[0];
			const tags = lesson.getElementsByTagName('h2');
			let i = 0;
			let arr = [];
			for (let tag of tags) {
				let tagId = 'h2_'+i;
				tag.id = tagId;
				i++;
				arr.push({text: tag.textContent, id: tagId });	
			}
			this.set({ lessonTags: arr });
		},
		checkForArticles(id,articles) {
			if (id == 'articles') {
				
				let tbody = document.getElementById('articles');

				for (let article of articles) {
		
					let row = `<tr>
						<td><a  href="${ article.url }" target="_blank">${ article.title }</a></td>
						<td>${ article.author}</td>
						<td>${ article.cat}</td>
					</tr>`;
					tbody.insertAdjacentHTML('beforeend', row);
				}
			}			
		},
		checkForVideos(id,videos) {
			if (id == 'videos') {
					
					let tbody = document.getElementById('videos');

					for (let video of videos) {
			
						let row = `<tr>
							<td><a href="${ video.url }" target="_blank"><img width="200" class="videoThumb" src="../img/${ video.img }.png"/></a></td>
							<td><a href="${ video.url }" target="_blank"> ${ video.title }</a></td>
							<td>${ video.platform}</td>
							<td class="small">${ video.length}</td>
							<td>${ video.price}</td>
						</tr>`;
						tbody.insertAdjacentHTML('beforeend', row);
					}
				}			
		}		
};

function oncreate$4() {

	
//{img: '', url: '', title: '', platform: '', length: '', price: ''},	
	const videos = [
		{img: 'grave', url: 'https://vimeo.com/159184788', title: 'A Grave Injustice (about the carbon dating)', platform: 'vimeo', length: '27 minutes', price: 'free'},			
		{img: 'russ', url: 'https://shroudstory.com/2014/12/14/russ-breault-the-shroud-of-turin-in-fifteen-minutes/', title: ' Russ Breault on the Shroud of Turin', platform: 'youtube', length: '15 minutes', price: 'free'},
		{img: 'barrie', url: 'https://shroudstory.com/2013/05/03/barrie-schwortz-tedx-via-della-conciliazione-talk/', title: 'Barrie Schwortz Ted Talk', platform: 'youtube', length: '14 minutes', price: 'free'},
		{img: 'gary', url: 'https://www.youtube.com/watch?v=rEg7kpo6WY0&feature=youtu.be', title: 'The Shroud of Turin, Could it be Real? (Gary Habermas)', platform: 'youtube', length: '44 minutes', price: 'free'},	
		{img: 'face', url: 'https://vimeo.com/47220836', title: 'The Real Face of Jesus - History Channel', platform: 'vimeo', length: '90 minutes', price: 'free'},
		{img: 'unwrap', url: 'https://www.youtube.com/watch?v=YWyiZtagxX8', title: 'Unwrapping The Shroud of Turin New Evidence - Discovery Channel', platform: 'youtube', length: '43 minutes', price: 'free'},
		{img: 'cold', url: 'https://tubitv.com/movies/319148/cold_case_the_shroud_of_turin', title: 'Cold Case - Shroud of Turin (in Italian, subtitled)', platform: 'tubitv', length: '72 minutes', price: 'free'},
		{img: 'silent', url: 'https://vimeo.com/72410189', title: 'Silent Witness (Rolfe, 1978)', platform: 'vimeo', length: '56 minutes', price: 'free'},
		
	]; 
	//		{url: '', title: '', author: '', cat: ''},

	const articles = [  
		{url: 'https://www.catholic.com/magazine/print-edition/trial-of-the-shroud-of-turin', title: 'Trial of the Shroud of Turin', author: 'Lawrence E. Schauf', cat: 'article'},
		//{url: 'http://www.ancientfaith.com/specials/holy_image_holy_blood/rev._dn._stephen_muse_phd_lmft_ccmhc_bcets', title: 'Holy Image Holy Blood (2015)', author: 'Rev. Dn. Stephen Muse', cat: 'article'},	
		
	{ url: 'http://shroud.com/', title: 'Shroud.com', author: 'Barrie Schwortz', cat: 'website'},
	{url: 'http://shroudresearch.net/conference-2017.html', title: '2017 Pasco Shroud Conference', author: 'various', cat: 'website'},	
		{ url: 'https://manoftheshroud.wordpress.com/', title: 'Who Is the Man of the Shroud?', author: 'White & Mangum', cat: 'podcast'},
		{url: 'http://shroud.com/bstsmain.htm', title: 'British Society for the Turin Shroud', author: 'various', cat: 'article'},	
		{ url: 'https://shroudstory.com', title: 'Shroud Story', author: 'Dan Porter', cat: 'blog'},	
		{ url: 'http://shroudofturin.com/Resources/CRTSUM.pdf', title: 'A Critical Summary of Observations, Data and Hypotheses', author: 'Dr. John Jackson', cat: 'pdf'},
		{url: 'http://shroudencounter.com/worddocuments/Fact_Sheet.pdf', title: 'Shroud Fact Sheet', author: 'Russ Breault', cat: 'pdf'},
		{url: 'https://wfsites.websitecreatorprotool.com/a37eb50e.com/Summary-of-Scientific-Research-on-the-Shroud-of-Turin.pdf', title: 'Summary of Scientific Research on the Shroud of Turin', author: 'Robert Rucker', cat: 'pdf'},	
		{ url: 'https://www.nationalreview.com/2016/04/shroud-turin-jesus-christ-blood-relic-sudarium-oviedo/', title: 'The Shroud of Turin, Authenticated Again', author: 'Myra Adams', cat: 'article'},	
		{ url: 'https://www.catholicworldreport.com/2015/04/01/the-other-shroud-of-christ/', title: 'The “Other” Shroud of Christ (Sudarium)', author: 'Mary Jo Anderson', cat: 'article'},	
		{url: 'http://greatshroudofturinfaq.com/index.html', title: 'The Definitive Shroud of Turin FAQ', author: 'Dan Porter', cat: 'website'},		
		{url: 'http://www.ncregister.com/blog/longenecker/the-shroud-of-turin-and-the-facts', title: 'The Shroud of Turin and the Facts', author: 'Fr. Dwight Longenecker', cat: 'article'},
		{url: 'http://www.innoval.com/C14/', title: 'Carbon 14 Dating Mistakes with the Shroud of Turin', author: 'Dan Porter', cat: 'website'},
		{url: 'https://www.shroud.com/pdfs/ohiomaloneypaper.pdf', title: 'What Went Wrong With the Shroud’s Radiocarbon Date?', author: 'Paul C. Maloney', cat: 'pdf'},
		{url: 'https://www.scribd.com/doc/315981446/2012-07-26-Yannick-Clement-the-Evidence-of-the-Bloodstains', title: 'Don`t forget the evidence of the bloodstains!', author: 'Yannick Clement', cat: 'article'},
		{url: 'http://shroudinquiry.com', title: 'Shroud Inquiry', author: 'Don Vickers', cat: 'website'},	
		{url: 'http://www.shroud.com/pdfs/stlemarinellippt.pdf', title: 'The Shroud and the iconography of Christ (images)', author: 'Emanuela Marinelli', cat: 'pdf'},	
		{url: 'http://www.shroud.com/pdfs/stlemarinellipaper.pdf', title: 'The Shroud and the iconography of Christ (article)', author: 'Emanuela Marinelli', cat: 'pdf'},
		{url: 'http://www.shroud.com/pdfs/marinellivppt.pdf', 'title': 'The setting for the radiocarbon dating of the Shroud', author: 'Emanuela Marinelli', cat: 'pdf'},
		{url: 'http://www.shroud.com/pdfs/kearse1.pdf', title: '[human blood on Shroud] Is the current data sufficient?', author: 'Kelly P. Kearse', cat: 'pdf'},
		{url: 'http://www.shroud.com/pdfs/kearse4.pdf', title: 'What type of blood is present on the Shroud of Turin?', author: 'Kelly P. Kearse', cat: 'pdf'},	
		{url: 'https://www.shroud.com/pdfs/stlkearsepaper.pdf', title: 'A Critical (Re)evaluation of the Shroud of Turin Blood Data', author: 'Kelly P. Kearse', cat: 'pdf'},	
		{url: 'http://www.shroud.com/pdfs/sorensen2.pdf', title: 'Summary of Challenges to the Authenticity of the Shroud of Turin (2007)', author: 'Richard B. Sorensen', cat: 'pdf'},
		{url: 'http://epistle.us/articles/shroudofturin1.html', title: 'Is the Shroud of Turin Really Christ`s Burial Cloth? (2012)', author: 'Bruce L. Gerig', cat: 'article'},
		{url: 'http://www.sindone.info/BALDAKI2.PDF', title: 'Religions, Christianity, and Shroud', author: 'Giuseppe Baldacchini', cat: 'pdf'},
		{url: 'http://www.lastampa.it/2012/07/03/vaticaninsider/the-holy-shroud-one-big-bang-and-the-body-was-gone-3Nt6C7kPg9oMxFceRWVWlL/pagina.html', title: 'The Holy Shroud: One Big Bang and the body was gone',  author: 'Giuseppe Baldacchini', cat: 'article'},	
		{url: 'https://www.shroud.com/fanti3en.pdf', title: 'Results of a probabilistic model', author: 'Fanti & Emanuelli', cat: 'pdf'},
		{url: 'http://www.reviewofreligions.org/2242/the-turin-shroud-%E2%80%93-a-genuine-article/', title: 'Shroud of Turin - A Genuine Article (1997)', author: 'Basit Ahmad', cat: 'article'},
		{url: 'http://www.sindone.info/TYRER1.PDF', title: 'Looking at the Turin Shroud as a Textile (1981)', author: 'John Tyrer', cat: 'pdf'},
		{url: 'https://pdfs.semanticscholar.org/9a52/a6a7ce52face60565e3c8f6caaf83426324b.pdf', title: 'The Shroud of Turin’s ‘Blood’ Images: Blood, or Paint? (2000)', author: 'David Ford', cat: 'pdf'},
		{url: 'http://www.wilmina.ac.jp/ojc/edu/kiyo_2008/kiyo_38_PDF/04.pdf', title: 'The Right Date for the Wrong Part of the Shroud of Turin (2008)', author: 'William David Cline', cat: 'pdf'},
		{url: 'http://shroudnm.com/docs/2010-02-24-Shroud-Restoration-Eval.pdf', title: 'THE “RESTORATION” OF THE TURIN SHROUD', author: 'William Meacham', cat: 'pdf'},
		
		

	];		
	const state = store.get();
	const id = state.id;
	console.log('dawg id is '+id);
	console.log('id is '+id);

	const comp = this;
	const elmnt = document.getElementById("postWrap");
	elmnt.scrollIntoView();	

	const urly = `../posts/${ id }.html`;
	return fetch(urly).then(function(res) {
	return res.text();
		})
		.then(function(html) {
			// html = html.replace(/[\r\n\t]/g, '');
			// html = html.replace(/@@/g, '\n');
			//html = html.replace(/<\/pre>/g, '</pre><div class="cns"></div')
			comp.set({'desc':html});
			comp.addH2Tags(); 

			/* adds our bg colors to spans so we have colorful headings in sections */

			const sections = document.querySelectorAll('.lesson > p > span');
			const lightCols = ['rgb(236, 240, 32)','rgb(255, 208, 113)'];

			sections.forEach(function(section) {
				let { colors } = comp.get();
				if (!colors) colors = {};
				let col = colors.color1 || 'red';
				section.style.backgroundColor = col;

				if (lightCols.includes(col)){
					section.style.color = '#000';
				}
				//section.insertAdjacentHTML('beforeBegin', '<hr />');
			});

			comp.checkForArticles(id,articles);
			comp.checkForVideos(id,videos);
		});
       

	}
function store_1$3() {
	return store;
}

const file$8 = "src\\pages\\post-details\\post-details.html";

function create_main_fragment$8(component, ctx) {
	var div, text, div_1, text_1, div_transition, current;

	var if_block = (ctx.details) && create_if_block$4(component, ctx);

	var if_block_1 = (ctx.lessonTags) && create_if_block_1$2(component, ctx);

	function select_block_type(ctx) {
		if (ctx.details[0] == 'event') return create_if_block_2$1;
		return create_if_block_3$1;
	}

	var current_block_type = select_block_type(ctx);
	var if_block_2 = current_block_type(component, ctx);

	return {
		c: function create() {
			div = createElement("div");
			if (if_block) if_block.c();
			text = createText("\r\n\r\n\r\n\r\n");
			div_1 = createElement("div");
			if (if_block_1) if_block_1.c();
			text_1 = createText("\r\n\r\n\t");
			if_block_2.c();
			div_1.className = "content is-large desc";
			addLoc(div_1, file$8, 7, 0, 172);
			div.id = "postWrap";
			div.className = "content is-medium svelte-2rw6gw";
			addLoc(div, file$8, 0, 0, 0);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			if (if_block) if_block.m(div, null);
			appendNode(text, div);
			appendNode(div_1, div);
			if (if_block_1) if_block_1.m(div_1, null);
			appendNode(text_1, div_1);
			if_block_2.m(div_1, null);
			current = true;
		},

		p: function update(changed, ctx) {
			if (ctx.details) {
				if (if_block) {
					if_block.p(changed, ctx);
				} else {
					if_block = create_if_block$4(component, ctx);
					if_block.c();
					if_block.m(div, text);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (ctx.lessonTags) {
				if (if_block_1) {
					if_block_1.p(changed, ctx);
				} else {
					if_block_1 = create_if_block_1$2(component, ctx);
					if_block_1.c();
					if_block_1.m(div_1, text_1);
				}
			} else if (if_block_1) {
				if_block_1.d(1);
				if_block_1 = null;
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block_2) {
				if_block_2.p(changed, ctx);
			} else {
				if_block_2.d(1);
				if_block_2 = current_block_type(component, ctx);
				if_block_2.c();
				if_block_2.m(div_1, null);
			}
		},

		i: function intro(target, anchor) {
			if (current) return;
			if (component.root._intro) {
				if (div_transition) div_transition.invalidate();

				component.root._aftercreate.push(() => {
					if (!div_transition) div_transition = wrapTransition(component, div, fade, {}, true);
					div_transition.run(1);
				});
			}
			this.m(target, anchor);
		},

		o: function outro(outrocallback) {
			if (!current) return;

			if (!div_transition) div_transition = wrapTransition(component, div, fade, {}, false);
			div_transition.run(0, () => {
				outrocallback();
				div_transition = null;
			});

			current = false;
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}

			if (if_block) if_block.d();
			if (if_block_1) if_block_1.d();
			if_block_2.d();
		}
	};
}

// (2:0) {#if details}
function create_if_block$4(component, ctx) {
	var h1, text_value = ctx.details[1].menu, text;

	return {
		c: function create() {
			h1 = createElement("h1");
			text = createText(text_value);
			h1.id = "post";
			setStyle(h1, "background-color", ctx.colors.color1);
			h1.className = "svelte-2rw6gw";
			addLoc(h1, file$8, 2, 2, 80);
		},

		m: function mount(target, anchor) {
			insertNode(h1, target, anchor);
			appendNode(text, h1);
		},

		p: function update(changed, ctx) {
			if ((changed.details) && text_value !== (text_value = ctx.details[1].menu)) {
				text.data = text_value;
			}

			if (changed.colors) {
				setStyle(h1, "background-color", ctx.colors.color1);
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(h1);
			}
		}
	};
}

// (10:2) {#each lessonTags as tag}
function create_each_block$4(component, ctx) {
	var span, text_value = ctx.tag.text, text;

	return {
		c: function create() {
			span = createElement("span");
			text = createText(text_value);
			span._svelte = { component, ctx };

			addListener(span, "click", click_handler$1);
			span.className = "tag";
			addLoc(span, file$8, 10, 2, 259);
		},

		m: function mount(target, anchor) {
			insertNode(span, target, anchor);
			appendNode(text, span);
		},

		p: function update(changed, ctx) {
			if ((changed.lessonTags) && text_value !== (text_value = ctx.tag.text)) {
				text.data = text_value;
			}

			span._svelte.ctx = ctx;
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(span);
			}

			removeListener(span, "click", click_handler$1);
		}
	};
}

// (9:1) {#if lessonTags}
function create_if_block_1$2(component, ctx) {
	var each_anchor;

	var each_value = ctx.lessonTags;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$4(component, get_each_context$4(ctx, each_value, i));
	}

	return {
		c: function create() {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_anchor = createComment();
		},

		m: function mount(target, anchor) {
			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insertNode(each_anchor, target, anchor);
		},

		p: function update(changed, ctx) {
			if (changed.lessonTags) {
				each_value = ctx.lessonTags;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$4(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block$4(component, child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_anchor.parentNode, each_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		d: function destroy$$1(detach) {
			destroyEach(each_blocks, detach);

			if (detach) {
				detachNode(each_anchor);
			}
		}
	};
}

// (17:1) {#if details[0] == 'event'}
function create_if_block_2$1(component, ctx) {
	var div;

	return {
		c: function create() {
			div = createElement("div");
			div.className = "lesson";
			addLoc(div, file$8, 17, 1, 387);
		},

		m: function mount(target, anchor) {
			insertNode(div, target, anchor);
			div.innerHTML = ctx.desc;
		},

		p: function update(changed, ctx) {
			if (changed.desc) {
				div.innerHTML = ctx.desc;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(div);
			}
		}
	};
}

// (22:1) {:else}
function create_if_block_3$1(component, ctx) {
	var section;

	return {
		c: function create() {
			section = createElement("section");
			addLoc(section, file$8, 22, 1, 449);
		},

		m: function mount(target, anchor) {
			insertNode(section, target, anchor);
			section.innerHTML = ctx.desc;
		},

		p: function update(changed, ctx) {
			if (changed.desc) {
				section.innerHTML = ctx.desc;
			}
		},

		d: function destroy$$1(detach) {
			if (detach) {
				detachNode(section);
			}
		}
	};
}

function get_each_context$4(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.tag = list[i];
	child_ctx.each_value = list;
	child_ctx.tag_index = i;
	return child_ctx;
}

function click_handler$1(event) {
	const { component, ctx } = this._svelte;

	component.scrollTag(ctx.tag.id);
}

function Post_details(options) {
	this._debugName = '<Post_details>';
	if (!options || (!options.target && !options.root)) throw new Error("'target' is a required option");
	init(this, options);
	this.store = store_1$3();
	this._state = assign(this.store._init(["sectionColors","id","snippets","cats"]), options.data);
	this.store._add(this, ["sectionColors","id","snippets","cats"]);
	this._recompute({ $sectionColors: 1, $id: 1, $snippets: 1, $cats: 1 }, this._state);
	if (!('$sectionColors' in this._state)) console.warn("<Post_details> was created without expected data property '$sectionColors'");
	if (!('$id' in this._state)) console.warn("<Post_details> was created without expected data property '$id'");
	if (!('$snippets' in this._state)) console.warn("<Post_details> was created without expected data property '$snippets'");
	if (!('$cats' in this._state)) console.warn("<Post_details> was created without expected data property '$cats'");


	if (!('lessonTags' in this._state)) console.warn("<Post_details> was created without expected data property 'lessonTags'");
	if (!('desc' in this._state)) console.warn("<Post_details> was created without expected data property 'desc'");
	this._intro = true;

	this._handlers.destroy = [removeFromStore];

	if (!options.root) {
		this._oncreate = [];
		this._aftercreate = [];
	}

	this._fragment = create_main_fragment$8(this, this._state);

	this.root._oncreate.push(() => {
		oncreate$4.call(this);
		this.fire("update", { changed: assignTrue({}, this._state), current: this._state });
	});

	if (options.target) {
		if (options.hydrate) throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		this._fragment.c();
		this._mount(options.target, options.anchor);

		callAll(this._oncreate);
		callAll(this._aftercreate);
	}
}

assign(Post_details.prototype, protoDev);
assign(Post_details.prototype, methods$7);

Post_details.prototype._checkReadOnly = function _checkReadOnly(newState) {
	if ('colors' in newState && !this._updatingReadonlyProperty) throw new Error("<Post_details>: Cannot set read-only property 'colors'");
	if ('snips' in newState && !this._updatingReadonlyProperty) throw new Error("<Post_details>: Cannot set read-only property 'snips'");
	if ('details' in newState && !this._updatingReadonlyProperty) throw new Error("<Post_details>: Cannot set read-only property 'details'");
};

Post_details.prototype._recompute = function _recompute(changed, state) {
	if (changed.$sectionColors || changed.$id) {
		if (this._differs(state.colors, (state.colors = colors(state)))) changed.colors = true;
	}

	if (changed.$snippets || changed.$id) {
		if (this._differs(state.snips, (state.snips = snips(state)))) changed.snips = true;
	}

	if (changed.$id || changed.$cats) {
		if (this._differs(state.details, (state.details = details(state)))) changed.details = true;
	}
};

class PostDetailsHandler {
  get route() {
    return {
      beforeenter: function ( route ) {
     
      },

      enter(current, previous) {
      //  console.log('the details route params are '+JSON.stringify(current.params))
        store.set({id: current.params.id});
    
        this.component = new Post_details({
          target: document.getElementById('app'),
          data: {
            desc: '',
            lessonTags: []
          }
        });
       // console.log('Entered post details!');
      },
      leave(current, previous) {
        this.component.destroy();
      //  console.log('Left post details!');
      }
    }
  }
}

class Routes {
  constructor() {
    this.router = roadtrip;
    this.init();
  }

  init() {
    this.index_handler = new IndexHandler();
    this.authors_handler = new AuthorsHandler();
    this.notebook_handler = new NotebookHandler();   
    this.post_details_handler = new PostDetailsHandler();
    this.author_details_handler = new AuthorDetailsHandler();

    this.router
      .add('/', this.index_handler.route)
     // .add('/snippets', this.snippets_handler.route)
     // .add('/snippets/:id', this.snippet_details_handler.route)  
      .add('/topics/:id', this.post_details_handler.route)      
      .add('/notebook', this.notebook_handler.route)   
      .add('/authors', this.authors_handler.route)   
      .add('/authors/:id', this.author_details_handler.route)
      .start({
        fallback: '/'
      });
  }
}

/*
 * This is the entrypoint of all the JavaScript files.
 */
//import './styles/_color_nav.css';


//const baseUrl = 'http://localhost:5100/';
//const baseUrl = 'https://es6.kwippe.com/';
//const urly = baseUrl+ 'data/snippets.json'
  
const store$1 = new Store({
  snippets: []
});

// fetch(urly)
//   .then(res => res.json())
//   .then(data => {
//      const snippets = data.snippets;
//      store.set({baseUrl: baseUrl, snippets: snippets });
//     // console.table(store.get())
//   });  

document.addEventListener('DOMContentLoaded', main);

function main () {
  window.Routes = new Routes();

    // const nav = new Nav({
    //     target: document.getElementById('nav'),
    //     store
    // })

    const menu = new Menu({
      target: document.getElementById('menu'),
      store: store$1
    });

}
window.store = store$1; // useful for debugging!

}());
//# sourceMappingURL=bundle.js.map
