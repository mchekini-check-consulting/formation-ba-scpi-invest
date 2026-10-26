package com.example.scpiinvest.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.junit.jupiter.api.Test;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;

class LoggingInterceptorTest {

	private final LoggingInterceptor interceptor = new LoggingInterceptor();

	private HandlerMethod handlerMethod(String methodName) throws NoSuchMethodException {
		Method method = Example.class.getDeclaredMethod(methodName);
		return new HandlerMethod(new Example(), method);
	}

	@Test
	void requeteReussieLogueEnInfoAvecRouteDeclareeEtDuree() throws Exception {
		HttpServletRequest request = mock(HttpServletRequest.class);
		HttpServletResponse response = mock(HttpServletResponse.class);
		when(request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE)).thenReturn("/items");
		when(request.getMethod()).thenReturn("GET");
		when(response.getStatus()).thenReturn(200);

		try (JsonLogCapture capture = new JsonLogCapture(LoggingInterceptor.class)) {
			interceptor.preHandle(request, response, handlerMethod("lister"));
			interceptor.afterCompletion(request, response, handlerMethod("lister"), null);

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(1);
			assertThat(lines.get(0)).containsEntry("level", "INFO")
					.containsEntry("layer", "controller")
					.containsEntry("route", "/items")
					.containsEntry("httpMethod", "GET")
					.containsEntry("status", 200)
					.containsEntry("method", "lister")
					.containsKey("durationMs");
		}
	}

	@Test
	void erreurClientLogueEnWarn() throws Exception {
		HttpServletRequest request = mock(HttpServletRequest.class);
		HttpServletResponse response = mock(HttpServletResponse.class);
		when(request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE)).thenReturn("/items");
		when(request.getMethod()).thenReturn("POST");
		when(response.getStatus()).thenReturn(400);

		try (JsonLogCapture capture = new JsonLogCapture(LoggingInterceptor.class)) {
			interceptor.preHandle(request, response, handlerMethod("creer"));
			interceptor.afterCompletion(request, response, handlerMethod("creer"), null);

			assertThat(capture.linesAsJson().get(0)).containsEntry("level", "WARN");
		}
	}

	@Test
	void erreurServeurOuExceptionLogueEnError() throws Exception {
		HttpServletRequest request = mock(HttpServletRequest.class);
		HttpServletResponse response = mock(HttpServletResponse.class);
		when(request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE)).thenReturn("/items");
		when(request.getMethod()).thenReturn("GET");
		when(response.getStatus()).thenReturn(200);

		try (JsonLogCapture capture = new JsonLogCapture(LoggingInterceptor.class)) {
			interceptor.preHandle(request, response, handlerMethod("lister"));
			interceptor.afterCompletion(request, response, handlerMethod("lister"), new RuntimeException("boom"));

			assertThat(capture.linesAsJson().get(0)).containsEntry("level", "ERROR");
		}
	}

	// Classe factice : seule la présence de méthodes "lister"/"creer" compte ici
	static class Example {

		void lister() {
		}

		void creer() {
		}

	}

}
