package com.example.scpiinvest.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import net.ttddyy.dsproxy.ExecutionInfo;
import net.ttddyy.dsproxy.QueryInfo;

class SlowQueryLoggingListenerTest {

	private final SlowQueryLoggingListener listener = new SlowQueryLoggingListener();

	private QueryInfo queryInfo(String sql) {
		QueryInfo queryInfo = mock(QueryInfo.class);
		when(queryInfo.getQuery()).thenReturn(sql);
		return queryInfo;
	}

	@Test
	void requeteNormaleNEstPasLoguee() {
		ExecutionInfo execInfo = mock(ExecutionInfo.class);
		when(execInfo.getElapsedTime()).thenReturn(5L);

		try (JsonLogCapture capture = new JsonLogCapture(SlowQueryLoggingListener.class)) {
			listener.afterQuery(execInfo, List.of(queryInfo("select 1")));
			assertThat(capture.linesAsJson()).isEmpty();
		}
	}

	@Test
	void requeteLenteLogueeEnWarnSansParametres() {
		ExecutionInfo execInfo = mock(ExecutionInfo.class);
		when(execInfo.getElapsedTime()).thenReturn(450L);

		try (JsonLogCapture capture = new JsonLogCapture(SlowQueryLoggingListener.class)) {
			listener.afterQuery(execInfo, List.of(queryInfo("select * from item where nom = ?")));

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(1);
			assertThat(lines.get(0)).containsEntry("level", "WARN")
					.containsEntry("layer", "db")
					.containsEntry("durationMs", 450)
					.containsEntry("query", "select * from item where nom = ?")
					.doesNotContainKey("parameters");
		}
	}

	@Test
	void requeteEnErreurLogueeEnError() {
		ExecutionInfo execInfo = mock(ExecutionInfo.class);
		when(execInfo.getElapsedTime()).thenReturn(1L);
		when(execInfo.getThrowable()).thenReturn(new IllegalStateException("relation absente"));

		try (JsonLogCapture capture = new JsonLogCapture(SlowQueryLoggingListener.class)) {
			listener.afterQuery(execInfo, List.of(queryInfo("select 1")));

			List<Map<String, Object>> lines = capture.linesAsJson();
			assertThat(lines).hasSize(1);
			assertThat(lines.get(0)).containsEntry("level", "ERROR")
					.containsEntry("layer", "db")
					.containsEntry("errorMessage", "relation absente");
		}
	}

}
