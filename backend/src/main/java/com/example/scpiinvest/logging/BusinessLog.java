package com.example.scpiinvest.logging;

import static net.logstash.logback.argument.StructuredArguments.value;

import org.slf4j.Logger;

import net.logstash.logback.argument.StructuredArgument;

// Écrit les logs "métier" (layer controller/service/db) avec les champs communs
// layer/class/method en argument structuré (JSON uniquement, jamais dans le message
// humain). Seules ces lignes portent un champ layer : ce sont les seules collectées
// dans Loki (cf. logback-spring.xml et helm.yaml côté plateforme).
public final class BusinessLog {

	private BusinessLog() {
	}

	public static void info(Logger log, String layer, String clazz, String method, String msg,
			StructuredArgument... fields) {
		log.info(msg, withLayer(layer, clazz, method, fields));
	}

	public static void warn(Logger log, String layer, String clazz, String method, String msg,
			StructuredArgument... fields) {
		log.warn(msg, withLayer(layer, clazz, method, fields));
	}

	public static void error(Logger log, String layer, String clazz, String method, String msg,
			StructuredArgument... fields) {
		log.error(msg, withLayer(layer, clazz, method, fields));
	}

	private static Object[] withLayer(String layer, String clazz, String method, StructuredArgument[] fields) {
		Object[] all = new Object[3 + fields.length];
		all[0] = value("layer", layer);
		all[1] = value("class", clazz);
		all[2] = value("method", method);
		System.arraycopy(fields, 0, all, 3, fields.length);
		return all;
	}

}
