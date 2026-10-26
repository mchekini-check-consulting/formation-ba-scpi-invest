package com.example.scpiinvest.logging;

import javax.sql.DataSource;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import net.ttddyy.dsproxy.support.ProxyDataSourceBuilder;

// Enveloppe la DataSource créée par Spring Boot avec datasource-proxy, pour que
// SlowQueryLoggingListener voie passer chaque requête (sans rien changer côté
// Flyway/Hibernate, qui continuent de voir une simple javax.sql.DataSource).
@Configuration
public class DataSourceLoggingConfig {

	// Méthode statique : un BeanPostProcessor doit être disponible avant que les
	// autres beans (dont la DataSource elle-même) ne soient instanciés.
	@Bean
	public static BeanPostProcessor dataSourceProxyBeanPostProcessor() {
		return new BeanPostProcessor() {
			@Override
			public Object postProcessAfterInitialization(Object bean, String beanName) {
				if (bean instanceof DataSource dataSource) {
					return ProxyDataSourceBuilder.create(dataSource)
							.name("scpi-invest")
							.listener(new SlowQueryLoggingListener())
							.build();
				}
				return bean;
			}
		};
	}

}
