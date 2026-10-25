package com.example.scpiinvest.logging;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;

import net.logstash.logback.encoder.LogstashEncoder;
import net.logstash.logback.fieldnames.LogstashFieldNames;

// Capture les événements de log d'une classe donnée et les encode en JSON avec les
// mêmes noms de champs que logback-spring.xml (time/msg), pour vérifier en test ce
// qui serait réellement écrit sur stdout en production.
final class JsonLogCapture implements AutoCloseable {

	private final Logger logger;
	private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
	private final LogstashEncoder encoder = new LogstashEncoder();
	private final ObjectMapper mapper = new ObjectMapper();

	JsonLogCapture(Class<?> loggedClass) {
		this.logger = (Logger) LoggerFactory.getLogger(loggedClass);
		LogstashFieldNames fieldNames = encoder.getFieldNames();
		fieldNames.setTimestamp("time");
		fieldNames.setMessage("msg");
		fieldNames.setVersion(null);
		fieldNames.setLevelValue(null);
		fieldNames.setLogger(null);
		fieldNames.setThread(null);
		encoder.setContext(logger.getLoggerContext());
		encoder.start();
		appender.start();
		logger.addAppender(appender);
	}

	List<Map<String, Object>> linesAsJson() {
		List<Map<String, Object>> lines = new ArrayList<>();
		for (ILoggingEvent event : appender.list) {
			lines.add(toJson(event));
		}
		return lines;
	}

	private Map<String, Object> toJson(ILoggingEvent event) {
		try {
			byte[] encoded = encoder.encode(event);
			return mapper.readValue(encoded, Map.class);
		} catch (IOException e) {
			throw new IllegalStateException(e);
		}
	}

	@Override
	public void close() {
		logger.detachAppender(appender);
		appender.stop();
		encoder.stop();
	}

}
