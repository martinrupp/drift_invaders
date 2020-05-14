
class GamepadController
{
	constructor(document)
	{
		this.keys = {};
		this.buttons = [];
		// see keycode getter here http://pomle.github.io/keycode/
		document.addEventListener('keydown', event => {
			this.keydown(event);
		});
		document.addEventListener('keyup', event => {
			this.keyup(event);
		});
	}

	keydown(event)
	{
		this.keys[event.keyCode] = true;
	}
	keyup(event)
	{
		this.keys[event.keyCode] = false;
	}

	buttonPressed(b)
	{
		if (typeof(b) == "object") {
			return b.pressed;
		}
		return b == 1.0;
	}

	addListener( button_list, repeat_delay, repeat_time, func_pressed = null, func_released = null )
	{
		var button = {
			button_list: button_list,
			repeat_delay: repeat_delay,
			repeat_time: repeat_time,
			func_pressed: func_pressed,
			func_released: func_released,
			is_repeating: false,
			time_pressed: 0
		}
		this.buttons.push( button );
		return button;
	}
	get_gamepads()
	{
		return navigator.getGamepads ? navigator.getGamepads() :
			(navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
	}

	is_pressed( btn )
	{
		let gamepad_id = btn[0]
		let button_id = btn[1]
		if(gamepad_id < 0)
			return this.is_pressed_key( button_id );
		else
		{
			var gamepads = this.get_gamepads();
			if (!gamepads || gamepad_id < 0 || gamepad_id >= gamepads.length) {
				return false;
			}
			var gp = gamepads[gamepad_id];
			if( !gp || !gp.buttons || gamepad_id < 0 || gamepad_id >= gp.buttons.length ) {
				return false;
			}
			var b = gp.buttons[ button_id ];
			if (typeof(b) == "object") {
				return b.pressed;
			}
			else {
				return b == 1.0;
			}
		}
	}
	is_pressed_key( keyid )
	{
		return this.keys[keyid];
	}
	playback(time, keys)
	{
		this.keys = keys;
		this.poll(time);
	}

	poll(time)
	{
		if( !this.get_gamepads() ) return;
		this.buttons.forEach( (button) => {
			let pressed = false;
			button.button_list.some( b => {
					pressed = this.is_pressed( b );
					return pressed;
				});

			if( pressed )
			{
				var delay = button.is_repeating ? button.repeat_time : button.repeat_delay;
				if(time - button.time_pressed > delay)
				{
					if(button.time_pressed)
						button.is_repeating = true;
					if( button.func_pressed ) {
						button.func_pressed(button);
					}
					button.time_pressed = time;
				}
			}
			else
			{
				if(button.time_pressed && button.func_released) {
					button.func_released(button);
				}
				button.is_repeating = false
				button.time_pressed = 0;
			}
		});
	}
}

// get keycodes here http://pomle.github.io/keycode/
var KeyCodes = {
	SPACE: [-1, 32],
	LEFT : [-1, 37],
	UP : [-1, 38],
	RIGHT: [-1, 39],
	DOWN: [-1, 40],
	// get keycode of a, e.g. KeyCodes.get("x")
	get: function(a)
	{
		return [-1, a.toUpperCase().charCodeAt(0)];
	}
}

// see gamepad layout here https://w3c.github.io/gamepad/#remapping
var GamePadCode = {
	BUTTON_DOWN: 0,
	BUTTON_RIGHT: 1,
	BUTTON_LEFT: 2,
	BUTTON_UP: 3,

	UP : 12,
	DOWN: 13,
	LEFT : 14,
	RIGHT: 15
}

