package com.example.scpiinvest.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanPostProcessor;

class DataSourceLoggingConfigTest {

	private final BeanPostProcessor processor = DataSourceLoggingConfig.dataSourceProxyBeanPostProcessor();

	@Test
	void envelopeLaDataSourceDansUnProxy() {
		DataSource original = mock(DataSource.class);
		Object wrapped = processor.postProcessAfterInitialization(original, "dataSource");
		assertThat(wrapped).isInstanceOf(DataSource.class).isNotSameAs(original);
	}

	@Test
	void laisseLesAutresBeansInchanges() {
		Object autre = new Object();
		assertThat(processor.postProcessAfterInitialization(autre, "autreBean")).isSameAs(autre);
	}

}
