function portal_html5_bridge_ensure_listener()
{
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
	return window.parent !== window;
}

function portal_html5_bridge_poll_json()
{
	portal_html5_bridge_ensure_listener();
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
