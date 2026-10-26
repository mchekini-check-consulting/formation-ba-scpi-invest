package com.example.scpiinvest.logging;

import static net.logstash.logback.argument.StructuredArguments.value;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

class BusinessLogTest {

	private final Logger log = LoggerFactory.getLogger(BusinessLogTest.class);

	@Test
	void ecritUneLigneJsonAvecLayerClassMethodEtLesChampsFournis() {
		try (JsonLogCapture capture = new JsonLogCapture(BusinessLogTest.class)) {
			BusinessLog.info(log, "controller", "ItemController", "lister", "GET /items 200",
					value("status", 200), value("durationMs", 3));

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(1);
			assertThat(lines.get(0)).containsEntry("level", "INFO")
					.containsEntry("msg", "GET /items 200")
					.containsEntry("layer", "controller")
					.containsEntry("class", "ItemController")
					.containsEntry("method", "lister")
					.containsEntry("status", 200)
					.containsEntry("durationMs", 3)
					.containsKey("time");
		}
	}

	@Test
	void warnEtErrorPortentAussiLeNiveau() {
		try (JsonLogCapture capture = new JsonLogCapture(BusinessLogTest.class)) {
			BusinessLog.warn(log, "db", "DataSource", "query", "requête lente", value("durationMs", 450));
			BusinessLog.error(log, "db", "DataSource", "query", "requête en erreur",
					value("errorMessage", "relation absente"));

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(2);
			assertThat(lines.get(0)).containsEntry("level", "WARN");
			assertThat(lines.get(1)).containsEntry("level", "ERROR");
		}
	}

}
