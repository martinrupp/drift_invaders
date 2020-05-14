//https://w3c.github.io/gamepad/#remapping
const canvas = document.getElementById('drift')
const context = canvas.getContext('2d')
var width = canvas.width;
var height = canvas.height;
 // context.scale(1,1);
var audio = new Audio('piu.mp3');
var boost = new Audio('boost2.mp3');
boost.volume = 0.2
var pong = new Audio('pong.mp3');
var explosion = new Audio('explosion2.mp3');
boost.addEventListener('ended', function() {
    this.currentTime = 0;
    this.play();
}, false);

var seed = 1;
function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
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

var deltaTime = 0;
var lastTime = 0;

var recording = []

var recorded_times = [];
var recorded_keys = [];

var playback_ = false;
var step = 0;

function update(time = 0)
{
	if( !playback_ )
	{
		gamepad.poll(time);
		// poll logic might change playback_
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
	// gamepad.poll(time);
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

gamepad = new GamepadController(document);


class Missle
{
	constructor(pos, vel, type)
	{
		this.pos = pos;
		this.vel = vel;
		this.type = type;
		let n = Math.sqrt(norm2(vel))
		this.nvec = {x:vel.x/n, y:vel.y/n}
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
		if( this.pos.x < 0 || this.pos.x > width || this.pos.y < 0 || this.pos.y > height)
			this.kill();
	}
	Draw(ctx)
	{
		ctx.fillStyle = 'white'
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
			boost.pause();
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
			var v = sub(player.pos, this.pos)
			var n = Math.sqrt(norm2(v))
			v.x /= n;
			v.y /= n;

			var pos;
			var vel;
			var mypos = { x:this.pos.x+10*v.x, y:this.pos.y+10*v.y };

			var speed = 300;
			if(false)
			{
				pos = {x: mypos.x, y: mypos.y}
				vel = { x:300*v.x, y:300*v.y }
			}
			else
			{
				pos = {x: mypos.x, y: mypos.y}
				vel = { x:300*v.x, y:300*v.y }

				let dpos = sub(mypos, player.pos);

				let t = norm(dpos)/speed;
				let SP = 0;
				for(let i = 0; i<10; i++)
				{
					// p + t*v = mypos + t*myvel
					// p.x + t*v.x = mypos.x + t*myvel.x
					// p.x-mypos.x + t*v.x = t*myvel.x
					vel.y = (player.pos.y-mypos.y + t*player.vel.y)/t;
					vel.x = (player.pos.x-mypos.x + t*player.vel.x)/t;
					SP = norm(vel)
					t *= SP/speed;
				}
				// console.log(SP);

				// only y:

				// mypos + t*vel = player.pos + t*player.vel
				// dpos = t*(player.vel-myvel)

				// dpos.x = t*(player.vel.x-myvel.x)
				// dpos.x/(player.vel.x-myvel.x) = t
				// dpos.x/(player.vel.x-myvel.x) = dpos.y/(player.vel.y-myvel.y)
				// (player.vel.x-myvel.x)*dpos.y = (player.vel.y-myvel.y)*dpos.x
				// player.vel.x*dpos.y-player.vel.y*dpos.x = myvel.x*dpos.y - myvel.y*dpos.x
				// a = (player.vel.x*dpos.y-player.vel.y*dpos.x) / VEL
				// a =  dvel.x*(1-X2) - dvel.y*X = -devl.x*X2 - dvel.y*X + devl.x

				// let VEL = 100;
				// let a = (player.vel.x*dpos.y-player.vel.y*dpos.x) / VEL // = (myvel.x*dpos.y - myvel.y*dpos.x) / VEL
				// sin * dpos.y - a = sqrt(1-sin2)*dpos.x
				// sin2 * dpos.y^2 - 2 a sin dpos.y + a^2 = (1-sin2) * dpos.x^2

				// if(v.x > v.y)
				// {

				// 	t = dvel.x/()
				// }

			}
			if( norm(vel) > 290 && norm(vel) < 310 )
			{
				pong.play();
				objects.push(new Missle( pos, vel, "foe" ));
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
		boost.pause();
		this.dead = true;
	}
	Controll()
	{
		if(lost_won) return;
		this.dalpha = 0;
		this.thrust = 0;
		if( gamepad.is_pressed(KeyCodes.LEFT) )
			this.dalpha = +0.005;
		if( gamepad.is_pressed(KeyCodes.RIGHT) )
			this.dalpha = -0.005;
		if( gamepad.is_pressed(KeyCodes.DOWN) )
		{
			this.thrust = -0.4;
		}
		// axis controlling
		var gp = gamepad.get_gamepads()
		if( gp && gp.length >= 1 && gp[0])
		{
			if(gp[0].axes.length > 0 && gp[0].axes[0] )
				this.dalpha -= 0.005 * gp[0].axes[0];
			if(gp[0].axes.length > 3 && gp[0].axes[3] )
				this.thrust = 0.4*gp[0].axes[3];
		}
		if(this.thrust != 0)
		{
			if(boost.currentTime>0.5)
				boost.currentTime=0;
			boost.play();
		}
		else
		{
			boost.pause();
		}

	}
	Update(time, dt)
	{
		if(lost_won) return;
		this.Controll();
		// this.valpha += this.dalpha*dt;
		// this.alpha += this.valpha*dt/1000;
		this.alpha += this.dalpha*dt;
		if( time > this.last_add + 10 )
		{
			if(this.last_positions.length > 100)
				this.last_positions.shift();
			this.last_positions.push( {x:this.pos.x, y:this.pos.y} );
			this.last_add = time;
		}

		//var vv = Math.sqrt(this.vel.x*this.vel.x+this.vel.y*this.vel.y);
		this.vel.x += Math.sin(this.alpha)*this.thrust*dt;
		this.vel.y += Math.cos(this.alpha)*this.thrust*dt;

		this.pos.x += this.vel.x*dt/1000;
		this.pos.y += this.vel.y*dt/1000;
		// if( this.pos.x < 0 )
		// 	this.pos.x = width;
		// if( this.pos.x > width )
		// 	this.pos.x = 0;
		// if( this.pos.y > height )
		// 	this.pos.y = 0;
		// if( this.pos.y < 0 )
		// 	this.pos.y = height;
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
		audio.currentTime = 0;
		audio.play()
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
		ctx.fillStyle = 'white'
		ctx.fillRect(this.pos.x, this.pos.y, 5, 5)
		var gp = gamepad.get_gamepads()
		if(gp.length > 0 && gp[0] && gp[0].axes.length > 0 && gp[0].axes[0] )
			ctx.fillRect(0, height/2, 20, height*0.4* gp[0].axes[0])


		var linelen = 20;
		ctx.strokeStyle="#FF0000";
		ctx.beginPath();
		ctx.moveTo(this.pos.x+2, this.pos.y+2);
		ctx.lineTo( this.pos.x +2+ Math.sin(this.alpha)*linelen, this.pos.y +2+ Math.cos(this.alpha)*linelen );
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(this.pos.x+2, this.pos.y+2);
		ctx.lineTo( this.pos.x +2+ this.vel.x, this.pos.y +2+ this.vel.y );
		ctx.stroke();

		{
			ctx.strokeStyle="#007700";
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
		for(let i=0; i<20; i++)
		{
			pos.x -= Math.sin(player.alpha)*10;
			pos.y -= Math.cos(player.alpha)*10;
		}

		this.last_positions.forEach( (pos, i) => {
			var f = Math.floor(i*256/this.last_positions.length) | 0;
			// console.log( (f).toString(16) );
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

var objects;
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

// playback();
restart();

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


update();
