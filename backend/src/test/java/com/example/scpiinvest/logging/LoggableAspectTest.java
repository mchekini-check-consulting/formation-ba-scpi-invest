package com.example.scpiinvest.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class LoggableAspectTest {

	@Loggable
	static class ExampleService {

		int doubler(int n) {
			return n * 2;
		}

		String refuser() {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "nom obligatoire");
		}

		String planter() {
			throw new IllegalStateException("connexion perdue");
		}

	}

	private ExampleService proxy() {
		AspectJProxyFactory factory = new AspectJProxyFactory(new ExampleService());
		factory.addAspect(new LoggableAspect());
		return factory.getProxy();
	}

	@Test
	void methodeReussieLogueEnInfoAvecLaDuree() {
		try (JsonLogCapture capture = new JsonLogCapture(LoggableAspect.class)) {
			ExampleService service = proxy();
			assertThat(service.doubler(21)).isEqualTo(42);

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(1);
			assertThat(lines.get(0)).containsEntry("level", "INFO")
					.containsEntry("layer", "service")
					.containsEntry("class", "ExampleService")
					.containsEntry("method", "doubler")
					.containsKey("durationMs");
		}
	}

	@Test
	void regleMetierLogueEnWarnEtRelanceLException() {
		try (JsonLogCapture capture = new JsonLogCapture(LoggableAspect.class)) {
			ExampleService service = proxy();
			assertThatThrownBy(service::refuser).isInstanceOf(ResponseStatusException.class);

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(1);
			assertThat(lines.get(0)).containsEntry("level", "WARN")
					.containsEntry("method", "refuser")
					.containsEntry("errorMessage", "nom obligatoire")
					.doesNotContainKey("arguments");
		}
	}

	@Test
	void erreurInattendueLogueEnError() {
		try (JsonLogCapture capture = new JsonLogCapture(LoggableAspect.class)) {
			ExampleService service = proxy();
			assertThatThrownBy(service::planter).isInstanceOf(IllegalStateException.class);

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(1);
			assertThat(lines.get(0)).containsEntry("level", "ERROR")
					.containsEntry("method", "planter")
					.containsEntry("errorMessage", "connexion perdue");
		}
	}

}
