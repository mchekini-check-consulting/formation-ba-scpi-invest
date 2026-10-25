package com.example.scpiinvest.logging;

import static net.logstash.logback.argument.StructuredArguments.value;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

// Couche service (layer service) : un log par méthode publique d'une classe (ou
// méthode) annotée @Loggable, à la sortie (succès ou échec), avec la durée.
// Règle métier (ResponseStatusException 4xx) : warn, erreur rejetée ; autre : error.
@Aspect
@Component
public class LoggableAspect {

	private static final Logger LOG = LoggerFactory.getLogger(LoggableAspect.class);

	@Around("@within(com.example.scpiinvest.logging.Loggable) || @annotation(com.example.scpiinvest.logging.Loggable)")
	public Object log(ProceedingJoinPoint joinPoint) throws Throwable {
		String clazz = joinPoint.getTarget().getClass().getSimpleName();
		String method = joinPoint.getSignature().getName();
		long start = System.nanoTime();
		try {
			Object result = joinPoint.proceed();
			BusinessLog.info(LOG, "service", clazz, method, clazz + "." + method + " ok",
					value("durationMs", elapsedMs(start)));
			return result;
		} catch (ResponseStatusException e) {
			if (e.getStatusCode().is4xxClientError()) {
				BusinessLog.warn(LOG, "service", clazz, method, clazz + "." + method + " en échec",
						value("durationMs", elapsedMs(start)),
						value("error", e.getClass().getSimpleName()),
						value("errorMessage", e.getReason()));
			} else {
				BusinessLog.error(LOG, "service", clazz, method, clazz + "." + method + " en échec",
						value("durationMs", elapsedMs(start)),
						value("error", e.getClass().getSimpleName()),
						value("errorMessage", e.getReason()));
			}
			throw e;
		} catch (Exception e) {
			BusinessLog.error(LOG, "service", clazz, method, clazz + "." + method + " en échec",
					value("durationMs", elapsedMs(start)),
					value("error", e.getClass().getSimpleName()),
					value("errorMessage", e.getMessage()));
			throw e;
		}
	}

	private static long elapsedMs(long startNanos) {
		return (System.nanoTime() - startNanos) / 1_000_000;
	}

}
