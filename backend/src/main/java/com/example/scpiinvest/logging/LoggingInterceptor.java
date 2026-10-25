package com.example.scpiinvest.logging;

import static net.logstash.logback.argument.StructuredArguments.value;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

// Couche contrôleur (layer controller) : un log par requête HTTP entrante, avec la
// route déclarée (jamais l'URL avec ses valeurs), le code de statut et la durée.
// Enregistré globalement (voir WebConfig). 4xx : warn ; 5xx ou exception : error.
@Component
public class LoggingInterceptor implements HandlerInterceptor {

	private static final Logger LOG = LoggerFactory.getLogger(LoggingInterceptor.class);
	private static final String START_ATTRIBUTE = LoggingInterceptor.class.getName() + ".start";

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		request.setAttribute(START_ATTRIBUTE, System.nanoTime());
		return true;
	}

	@Override
	public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
			Exception ex) {
		Long start = (Long) request.getAttribute(START_ATTRIBUTE);
		long durationMs = start == null ? 0 : (System.nanoTime() - start) / 1_000_000;
		String httpMethod = request.getMethod();
		String route = declaredRoute(request);
		int status = response.getStatus();
		String clazz = handler instanceof HandlerMethod hm ? hm.getBeanType().getSimpleName() : "unknown";
		String method = handler instanceof HandlerMethod hm ? hm.getMethod().getName() : "unknown";
		String msg = httpMethod + " " + route + " " + status;

		if (ex != null || status >= 500) {
			BusinessLog.error(LOG, "controller", clazz, method, msg,
					value("httpMethod", httpMethod), value("route", route), value("status", status),
					value("durationMs", durationMs));
		} else if (status >= 400) {
			BusinessLog.warn(LOG, "controller", clazz, method, msg,
					value("httpMethod", httpMethod), value("route", route), value("status", status),
					value("durationMs", durationMs));
		} else {
			BusinessLog.info(LOG, "controller", clazz, method, msg,
					value("httpMethod", httpMethod), value("route", route), value("status", status),
					value("durationMs", durationMs));
		}
	}

	// Route déclarée (ex. /items), jamais l'URI réelle avec ses valeurs
	private static String declaredRoute(HttpServletRequest request) {
		Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
		return pattern != null ? pattern.toString() : request.getRequestURI();
	}

}
