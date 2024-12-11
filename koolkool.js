request = require("util").promisify(require("request"))
prompt = require("prompt-sync")()
usern = "koolkool"
pathToFull = (function(a) {return function(b,c){return{url:new URL(b,a).href,body:c?new URLSearchParams({...c}).toString():"",headers:{"content-type":"application/x-www-form-urlencoded"}}}})("http://68.108.66.195:5000/connect/messenger/")
pref = "/kk/"

async function shutdown() {
	await Promise.allSettled([
		request({
			...pathToFull("update_solidstatus.php", {
				username: usern,
				password: globalThis.myPassword,
				status: "Offline"
			}),
			method: "POST"
		}),
		request({
			...pathToFull("logoff.php", {
				username: usern,
				password: globalThis.myPassword,
				status: "Offline"
			}),
			method: "POST"
		})
	])
}

(function(...a){cmds=Object.fromEntries(a.filter(function(b){return b.name}).map(function(b){return[b.name.slice(2),b]}))})(
	async function c_help({sender, msg, reply}) {
		await reply(`Hello, ${sender}! `)
	},
	async function c_experiment({reply}) {
		await reply("wow\nnewlines\nwow")
	}
)

void(async function([pass]) {
	while (Object.prototype.toString.call(pass) != "[object String]") pass = prompt(`Enter password for '${usern}': `)
	var login = await request({
		...pathToFull("login.php", {
			filename: usern,
			data: pass,
			ver: "v1.4"
		}),
		method: "POST"
	})
	if (login.body.toLowerCase() !== "success") return console.error("login failed!", login.body)
	globalThis.myPassword = pass
	await Promise.allSettled([
		request({
			...pathToFull("update_solidstatus.php", {
				username: usern,
				password: pass,
				status: "Online"
			}),
			method: "POST"
		}),
		request({
			...pathToFull("logoff.php", {
				username: usern,
				password: pass,
				status: "Online"
			}),
			method: "POST"
		})
	])
	// var allMsgs = {}
	var msgs
	async function loop() {
		try {
			msgs = (await request({
				...pathToFull("get_messages.php", {
					username: usern,
					password: pass
				}),
				method: "POST"
			})).body
			var mArr = msgs.split("\n").slice(0, -1)
			await Promise.allSettled(mArr.map(async function(chatid) {
				var logs = await request({
					...pathToFull("get_msg.php", {chatid}),
					method: "POST"
				})
				logs = logs.body.split("\n").slice(1, -1) // account for "This is the beginning of the message history" and the last empty line
				if (logs.length < 1) return
				var l = logs.reverse()[0]
				var splitL = l.split(": ")
				if (splitL.length < 2) return
				var [sender, ...fullMsg] = splitL
				if (sender === usern) return
				fullMsg = fullMsg.join(": ")
				if (!fullMsg.startsWith(pref)) return
				realMsg = fullMsg+""
				console.log(sender, "sent message", fullMsg)
				fullMsg = fullMsg.slice(pref.length)
				var cm = fullMsg.split(" ")[0].toLowerCase()
				// var args = fullMsg.slice(c.length+1).split(" ")
				var f, resp
				Object.entries(cmds).forEach(function([a, b]) {
					if (a==cm) f = b
				})
				if (!f) resp = `Unknown command, use ${pref}help to get command help.`
				if (resp) {
					await request({
						...pathToFull("update_msg.php", {
							chatid,
							username: usern,
							message: resp
						}),
						method: "POST"
					})
					return
				}
				var msgs = []
				await (async function() {
					await Promise.resolve(f({
						sender,
						msg: realMsg,
						reply: async function(a) {
							msgs.push(await request({
								...pathToFull("update_msg.php", {
									chatid,
									username: usern,
									message: a+""
								}),
								method: "POST"
							}))
						},
						id: chatid
					}))
					return resp
				})()
			}))
		} catch (_) {console.error(_.stack)}
		setTimeout(loop)
	}
	console.log("Press any character to exit.")
	loop()
	process.stdin.setRawMode(true)
	process.stdin.resume()
	await new Promise(function(a){process.stdin.on("data",a)})
	process.stdin.setRawMode(false)
	process.stdin.pause()
	await shutdown()
	process.exit(0)
})([])