function portal_html5_bridge_ensure_listener()
{
	portal_html5_audio_install();
	if (window.__heroesTrialPortalListenerInstalled)
		return;

	window.__heroesTrialPortalListenerInstalled = true;
	window.__heroesTrialPortalQueue = [];
	window.__heroesTrialPortalOrigin = "";

	window.addEventListener("message", function (event)
	{
		if (window.parent === window || event.source !== window.parent)
			return;

		if (typeof event.origin !== "string"
			|| event.origin === ""
			|| event.origin === "null")
			return;

		if (window.__heroesTrialPortalOrigin !== ""
			&& window.__heroesTrialPortalOrigin !== event.origin)
			return;

		var payload = event.data;
		if (typeof payload === "string")
		{
			try
			{
				payload = JSON.parse(payload);
			}
			catch (_error)
			{
				return;
			}
		}

		if (!payload || typeof payload !== "object")
			return;

		var type = payload.type;
		if (type !== "portal.bootstrap.v1"
			&& type !== "portal.save_ok.v1"
			&& type !== "portal.save_conflict.v1"
			&& type !== "portal.local_durable.v1"
			&& type !== "portal.result_ack.v1"
			&& type !== "portal.active_time_ack.v1"
			&& type !== "portal.visibility.v1")
			return;

		if (window.__heroesTrialPortalQueue.length >= 32)
			return;

		window.__heroesTrialPortalOrigin = event.origin;
		window.__heroesTrialPortalQueue.push({ origin: event.origin, data: payload });
	}, false);
}

function portal_html5_bridge_is_embedded()
{
	portal_html5_bridge_ensure_listener();
	portal_html5_audio_refresh();
	return window.parent !== window;
}

function portal_html5_bridge_poll_json()
{
	portal_html5_bridge_ensure_listener();
	portal_html5_audio_refresh();
	var queue = window.__heroesTrialPortalQueue;
	if (!queue || queue.length === 0)
		return "";

	return JSON.stringify(queue.shift());
}

function portal_html5_bridge_send_json(_messageJson)
{
	portal_html5_bridge_ensure_listener();
	if (window.parent === window || typeof _messageJson !== "string")
		return 0;

	var message;
	try
	{
		message = JSON.parse(_messageJson);
	}
	catch (_error)
	{
		return 0;
	}

	if (!message || typeof message !== "object")
		return 0;

	var targetOrigin = window.__heroesTrialPortalOrigin;
	if (message.type === "game.ready.v1")
		targetOrigin = "*";

	if (!targetOrigin)
		return 0;

	window.parent.postMessage(message, targetOrigin);
	return 1;
}

// GameMaker's stock HTML5 unlock listens for pointer/touch gestures only.
// Keyboard-first players must resume the same runtime context synchronously
// inside a real browser gesture, not from a Step event or parent postMessage.
function portal_html5_audio_install()
{
	if (window.__heroesTrialAudioInstalled)
		return;
	window.__heroesTrialAudioInstalled = true;
	window.__heroesTrialAudioResumePending = false;

	function unlock(event)
	{
		if (!event.isTrusted || event.repeat)
			return;
		var context = window.g_WebAudioContext;
		if (!context || context.state === "closed")
			return;
		var button = document.getElementById("heroes-trial-enable-audio");
		var canvas = document.getElementById("canvas");
		var clickedCanvas = canvas && event.target === canvas && event.type !== "keydown";
		if (clickedCanvas)
		{
			window.focus();
			canvas.tabIndex = 0;
			canvas.focus({ preventScroll: true });
		}
		if (context.state === "running")
			return;

		window.__heroesTrialAudioResumePending = true;
		// Do not put resume behind a timer/promise: that loses transient activation.
		// A previous resume promise may stay pending after a policy-blocked gesture;
		// every later real gesture must remain able to retry (notably touchend).
		try
		{
			Promise.resolve(context.resume()).then(function ()
			{
				window.__heroesTrialAudioResumePending = false;
				portal_html5_audio_refresh();
				if (context.state === "running" && button && event.target === button && canvas)
				{
					window.focus();
					canvas.tabIndex = 0;
					canvas.focus({ preventScroll: true });
				}
			}, function ()
			{
				window.__heroesTrialAudioResumePending = false;
				portal_html5_audio_refresh();
			});
		}
		catch (_error)
		{
			window.__heroesTrialAudioResumePending = false;
		}
	}

	["keydown", "pointerdown", "pointerup", "touchend", "click"].forEach(function (type)
	{
		document.addEventListener(type, unlock, true);
	});
}

function portal_html5_audio_refresh()
{
	var context = window.g_WebAudioContext;
	if (!context || !document.body)
		return;
	var button = document.getElementById("heroes-trial-enable-audio");
	if (!button && context.state !== "running" && context.state !== "closed")
	{
		button = document.createElement("button");
		button.id = "heroes-trial-enable-audio";
		button.type = "button";
		button.textContent = "ATIVAR SOM";
		button.title = "Clique ou pressione Enter para ativar musicas e vozes.";
		button.setAttribute("aria-label", "Ativar musicas e vozes do jogo");
		button.style.cssText = "position:fixed;right:16px;top:16px;z-index:1000;"
			+ "min-height:44px;max-width:calc(100% - 32px);padding:10px 18px;"
			+ "border:2px solid #f2b836;border-radius:8px;background:#142b3f;color:#f7ebcf;"
			+ "font:700 16px Georgia,serif;cursor:pointer;";
		document.body.appendChild(button);
	}
	if (button)
		button.hidden = context.state === "running" || context.state === "closed";
}
