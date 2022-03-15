//https://w3c.github.io/gamepad/#remapping
const canvas = document.getElementById('drift')
const context = canvas.getContext('2d')
var width = canvas.width;
var height = canvas.height;
 // context.scale(1,1);


// Audio
var playerShootAudio = new Audio('piu.mp3');
var enemyShootAudio = new Audio('pong.mp3');
var explosion = new Audio('explosion2.mp3');

// sound for the thrust / acceleration
var thrustAudio = new Audio('boost2.mp3');
thrustAudio.volume = 0.2
thrustAudio.addEventListener('ended', function() {
    this.currentTime = 0;
    this.play(); // sound will play in a loop until stopped
}, false);

// random number generator
var seed = 1;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// some math vector functions
function sub(v, v2)
{
	return {x: v.x-v2.x, y: v.y-v2.y};
}
function norm2(v)
{
	return v.x*v.x + v.y*v.y;
}
function norm(v)
{
	return Math.sqrt(v.x*v.x + v.y*v.y);
}
function normalize(v) {
	const n = norm(v);
	return {x:v.x/n, y:v.y/n}
}

function mult(v, alpha) {
	return {x: v.x*alpha, y: v.y*alpha}
}
function add(v, v2) {
	return {x: v.x+v2.x, y: v.y+v2.y}
}

var lost_won = 0;
function draw()
{
	context.fillStyle = '#000'
	context.fillRect(0, 0, width, height)

	objects.forEach( obj => {
		obj.Draw(context);
	})

	context.fillStyle = 'white'
	context.font = "20px Arial";
	context.fillText( player.shots + " Shots", 20, 20);
	context.fillText( num_enemies + " Enemies", 20, 40);
	if( lost_won )
	{
		context.fillText( lost_won, 300, 400);
	}
}

let deltaTime = 0;
let lastTime = 0;

let recording = []

let recorded_times = [];
let recorded_keys = [];

let playback_ = false;
let step = 0;
let gamepad = new GamepadController(document);

function update(time = 0)
{
	if( !playback_ )
	{
		gamepad.poll(time);
		// don't poll in playback since poll logic might change playback_
	}

	if( !playback_ )
		recording.push( {time: time, keys: Object.assign({}, gamepad.keys) } );
	else
	{
		if(step < recorded_times.length )
		{
			time = recorded_times[step];
			let keys = {};
			recorded_keys[step].forEach( (v) => { keys[v] = true; });
			gamepad.playback(time, keys);
			step++;
		}
	}
	deltaTime = time - lastTime;
	lastTime = time;

	objects.forEach( m => {
			if( !m.dead )
				m.Update(time, deltaTime/2);

			objects.forEach( m2 => {
				if( m.type == "friend" && m2.type == "foe" &&
					!m2.dead && norm2(sub(m.pos, m2.pos)) < 10*10 )
				{
					explosion.play()
					m.kill();
					m2.kill();
				}
			});
		});
	objects = objects.filter( obj => {
		return !obj.ToRemove();
	});
	draw();
	requestAnimationFrame(update);
}

// class for Missles shoot both by player and enemies
class Missle
{
	constructor(pos, vel, type)
	{
		this.pos = pos;
		this.vel = vel;
		this.type = type; // type is "friend" or 
		this.nvec = normalize(vel);
		this.dead = false;
	}
	kill()
	{
		this.dead = true;
	}
	Update(time, dt)
	{
		this.pos.x += this.vel.x*dt/1000;
		this.pos.y += this.vel.y*dt/1000;
		// out of bounds -> remove
		if( this.pos.x < 0 || this.pos.x > width || this.pos.y < 0 || this.pos.y > height)
			this.kill();
	}
	Draw(ctx)
	{
		// draw 8 "trails" of white, then increasingly darker squares
		for( let i=0; i<8; i++)
		{
			let f = 255-i*255/8 | 0;
			if( f < 16 )
				f = "0"+(f).toString(16)
			else
				f = (f).toString(16)
			ctx.fillStyle = "#"+f+f+f;
			ctx.fillRect(this.pos.x-2*this.nvec.x*i, this.pos.y-2*this.nvec.y*i, 5, 5);
		}
	}
	ToRemove()
	{
		return this.dead;
	}
}
var num_enemies = 0;

// this is an iteration algorithm to determine where we need to shoot
// the iteration "cheats" on the speed of the bullet, and adjusts the time until
// we are correct.
function calculateShootingAngle(pos, speed) {

	var v = normalize(sub(player.pos, pos));
	let mypos = add(pos, mult(v, 10));
	
	// our initial guess of the velocity is just "point in the direction of the player"
	let vel = mult(v, speed)
	// calculate our initial guess how much time the bullet takes to the player
	const dpos = sub(mypos, player.pos);
	let t = norm(dpos)/speed;
	for(let i = 0; i<10; i++)
	{
		// where is the player in T seconds?
		const playerInT = add(player.pos, mult(player.vel, t));
		// update our shooting vector so we shoot there, in T seconds.
		vel = mult(sub(playerInT, mypos), 1/t)
		// calculate the speed of the shooting vector
		const SP = norm(vel)
		// SP might be higher or lower than the desired speed.
		// if it's higher, it looks like we need more time,
		// so update the time.
		t *= SP/speed;
	}
	return vel;
}
class Enemy
{
	constructor(pos)
	{
		this.pos = pos;
		this.dead = false;
		this.last_shot = 0;
		this.type = "foe";
		num_enemies++;
	}
	kill()
	{
		num_enemies--;
		if(num_enemies == 0)
		{
			lost_won = "YOU WON!!!";
			// convert_rec();
			thrustAudio.pause();
		}
		this.dead = true;
	}
	Update(time, dt)
	{
		let shoot_time = 4000;
		if(this.last_shot == 0)
		{
			this.last_shot = time + (random()*shoot_time | 0);
			console.log(time, this.last_shot);
		}
		else if(time-this.last_shot > shoot_time && !player.dead)
		{
			// it's time to shoot!
			var speed = 300;
			let vel = calculateShootingAngle(this.pos, speed)
			if( norm(vel) > 290 && norm(vel) < 310 )
			{
				enemyShootAudio.play();
				objects.push(new Missle( {x: this.pos.x, y: this.pos.y}
					, vel, "foe" ));
				this.last_shot = time;
			}
		}
	}
	Draw(ctx)
	{
		ctx.fillStyle = 'red'
		ctx.fillRect(this.pos.x-5, this.pos.y-5, 10, 10);
	}
	ToRemove()
	{
		return this.dead;
	}
}


class Player
{
	constructor() {
		this.pos = {x: width/2, y: height/2};
		this.vel = {x: 0, y: 0};
		this.alpha = 0;
		this.valpha = 0;
		this.thrust = 0;
		this.dalpha = 0;
		this.last_positions = []
		this.last_add = 0;
		this.dead = false;
		this.last_shot = 0;
		this.shots = 30;
		this.type = "friend";
	}
	kill()
	{
		lost_won = "YOU LOST!";
		// convert_rec();
		thrustAudio.pause();
		this.dead = true;
	}
	Controll()
	{
		if(lost_won) return;

		const maxTurnConstant = 0.005;
		const maxTrustConstant = 0.4;
		this.dalpha = 0;
		this.thrust = 0;

		if( gamepad.is_pressed(KeyCodes.LEFT) )
			this.dalpha = +maxTurnConstant;
		if( gamepad.is_pressed(KeyCodes.RIGHT) )
			this.dalpha = -maxTurnConstant;
		if( gamepad.is_pressed(KeyCodes.DOWN) )
		{
			this.thrust = -maxTrustConstant;
		}
		// axis controlling
		var gp = gamepad.get_gamepads()
		if( gp && gp.length >= 1 && gp[0])
		{
			if(gp[0].axes.length > 0 && gp[0].axes[0] )
				this.dalpha -= maxTurnConstant * gp[0].axes[0];
			if(gp[0].axes.length > 3 && gp[0].axes[3] )
				this.thrust = maxTrustConstant*gp[0].axes[3];
		}
		if(this.thrust != 0)
		{
			if(thrustAudio.currentTime>0.5)
				thrustAudio.currentTime=0;
			thrustAudio.play();
		}
		else
		{
			thrustAudio.pause();
		}

	}
	Update(time, dt)
	{
		if(lost_won) return;
		this.Controll();
		this.alpha += this.dalpha*dt;

		// for displaying movement trails
		// add current position every 10ms
		if( time > this.last_add + 10 )
		{
			// if we have more than 100 trails, remove the first one
			if(this.last_positions.length > 100)
				this.last_positions.shift();
			this.last_positions.push( {x:this.pos.x, y:this.pos.y} );
			this.last_add = time;
		}

		// update velocity with current acceleartion (thrust)
		this.vel.x += Math.sin(this.alpha)*this.thrust*dt;
		this.vel.y += Math.cos(this.alpha)*this.thrust*dt;

		// update (iterate) position
		this.pos.x += this.vel.x*dt/1000;
		this.pos.y += this.vel.y*dt/1000;

		// out of bounds -> dead
		if( this.pos.x < 0 || this.pos.x > width || this.pos.y > height || this.pos.y < 0 )
		{
			explosion.play()
			this.kill();
		}


		//console.log( missles.length );
	}
	Move(v)
	{
		this.vel.x += Math.sin(this.alpha)*10*v;
		this.vel.y += Math.cos(this.alpha)*10*v;
	}
	shoot()
	{
		if(this.dead)
			return;
		// if(this.last_shot > lastTime) return;
		// this.last_shot = lastTime;
		if( this.shots <= 0 ) return;
		this.shots --;
		playerShootAudio.currentTime = 0;
		playerShootAudio.play()
		var pos = Object.assign({}, this.pos);
		var v = -600;
		var vel = { x: player.vel.x+Math.sin(player.alpha)*v, y: player.vel.y+Math.cos(player.alpha)*v };
		var n = norm(vel)
		pos.x += vel.x/n*10;
		pos.y += vel.y/n*10;
		objects.push( new Missle(pos, vel, "friend") );
	}
	Draw(ctx)
	{
		// draw central white square
		ctx.fillStyle = 'white'
		ctx.fillRect(this.pos.x, this.pos.y, 5, 5)

		var gp = gamepad.get_gamepads()
		if(gp.length > 0 && gp[0] && gp[0].axes.length > 0 && gp[0].axes[0] )
			ctx.fillRect(0, height/2, 20, height*0.4* gp[0].axes[0])


		var linelen = 20;
		ctx.strokeStyle="#FF0000"; // red
		// draw current heading line (alpha)
		ctx.beginPath();
		ctx.moveTo(this.pos.x+2, this.pos.y+2);
		ctx.lineTo( this.pos.x +2+ Math.sin(this.alpha)*linelen, this.pos.y +2+ Math.cos(this.alpha)*linelen );
		ctx.stroke();

		// draw current velocity line (vel)
		ctx.beginPath();
		ctx.moveTo(this.pos.x+2, this.pos.y+2);
		ctx.lineTo( this.pos.x +2+ this.vel.x, this.pos.y +2+ this.vel.y );
		ctx.stroke();

		// draw "shooting" line: this combines current heading + current velocity
		// and will be the orientation where the player's missles will go
		{
			ctx.strokeStyle="#007700";  // green
			var pos = Object.assign({}, this.pos);
			var v = -600;
			var vel = { x: player.vel.x+Math.sin(player.alpha)*v, y: player.vel.y+Math.cos(player.alpha)*v };
			// var vel = { x: Math.sin(player.alpha)*v, y: Math.cos(player.alpha)*v };
			var n = norm(vel)
			pos.x += vel.x/n*10;
			pos.y += vel.y/n*10;
			ctx.beginPath();
			ctx.moveTo(pos.x, pos.y);
			pos.x += vel.x*100;
			pos.y += vel.y*100;
			ctx.lineTo(pos.x, pos.y);
			ctx.stroke();
		}

		// draw last position trails
		this.last_positions.forEach( (pos, i) => {
			var f = Math.floor(i*256/this.last_positions.length) | 0;
			if( f < 16 )
				f = "0"+(f).toString(16)
			else
				f = (f).toString(16)
			ctx.fillStyle = "#"+f+f+f;
			ctx.fillRect(pos.x, pos.y, 2, 2);
		})
	}
	ToRemove()
	{
		return this.dead;
	}
}

// output the current recording to console (to create new recordings)
function convert_rec()
{
	recorded_times = [];
	recorded_keys = [];
	// console.log(JSON.stringify(recording))
	for(var i=0; i<recording.length; i++)
	{
		k = []
		for( let v in recording[i].keys )
		{
			if( recording[i].keys[v] )
				k.push(v);
		}
		recorded_keys.push(k);
		recorded_times.push(recording[i].time)
	}
	console.log(JSON.stringify(recorded_times))
	console.log(JSON.stringify(recorded_keys))
}

var objects; // array of all objects (player, enemies, missles)
function restart()
{
	if(! playback_) recording = [];
	player = new Player();

	objects = [ player ]
	num_enemies = 0;
	seed = 1;
	lost_won = 0;
	for(var i=0; i<10; i++)
	{
		objects.push(new Enemy( {x: random()*width | 0, y: random()*height | 0} ) );
	}
}

function playback()
{
	playback_ = true;
	restart();
}

gamepad.addListener( [ KeyCodes.SPACE, [0, GamePadCode.BUTTON_RIGHT] ], 300, 100, (button) => { player.shoot(); } );

document.addEventListener('keydown', event => {
		if(event.keyCode == KeyCodes.get("r")[1])
		{
			playback_ = false;
			gamepad.keys = [];
			restart();
		}
		else if(event.keyCode == KeyCodes.get("d")[1])
		{
			step = 0;
			playback();
		}
	});

// gamepad.addListener( [ KeyCodes.get("r") ], 300, 100, (button) => { playback_ = false; restart(); } );
// gamepad.addListener( [ KeyCodes.get("d") ], 300, 100, (button) => { playback(); } );

// playback();
restart();
update();
