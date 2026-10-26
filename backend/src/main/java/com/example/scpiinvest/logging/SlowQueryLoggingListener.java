package com.example.scpiinvest.logging;

import static net.logstash.logback.argument.StructuredArguments.value;

import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.ttddyy.dsproxy.ExecutionInfo;
import net.ttddyy.dsproxy.QueryInfo;
import net.ttddyy.dsproxy.listener.QueryExecutionListener;

// Couche base de données (layer db) : seulement les requêtes en erreur et les
// requêtes lentes (au-delà de SLOW_THRESHOLD_MS). Les requêtes normales ne sont
// jamais logguées (volume), et jamais les paramètres (données personnelles) : seul
// le texte SQL paramétré (avec des "?") est gardé, pas les valeurs liées.
public class SlowQueryLoggingListener implements QueryExecutionListener {

	private static final Logger LOG = LoggerFactory.getLogger(SlowQueryLoggingListener.class);
	private static final long SLOW_THRESHOLD_MS = 200;

	@Override
	public void beforeQuery(ExecutionInfo execInfo, List<QueryInfo> queryInfoList) {
	}

	@Override
	public void afterQuery(ExecutionInfo execInfo, List<QueryInfo> queryInfoList) {
		Throwable error = execInfo.getThrowable();
		long durationMs = execInfo.getElapsedTime();
		if (error == null && durationMs < SLOW_THRESHOLD_MS) {
			return;
		}
		String query = queryInfoList.stream().map(QueryInfo::getQuery).collect(Collectors.joining("; "));
		if (error != null) {
			BusinessLog.error(LOG, "db", "DataSource", "query", "requête en erreur",
					value("query", query), value("error", error.getClass().getSimpleName()),
					value("errorMessage", error.getMessage()));
		} else {
			BusinessLog.warn(LOG, "db", "DataSource", "query", "requête lente",
					value("query", query), value("durationMs", durationMs));
		}
	}

}
