package com.example.sound.global.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // Exchange
    public static final String EXCHANGE = "video.exchange";

    // 🔥 Queue 2개
    public static final String REQUEST_QUEUE = "video.request.queue";
    public static final String RESPONSE_QUEUE = "video.response.queue";

    // 🔥 Routing Key 2개
    public static final String REQUEST_KEY = "video.request";
    public static final String RESPONSE_KEY = "video.response";

    // Exchange
    @Bean
    public DirectExchange exchange() {
        return new DirectExchange(EXCHANGE);
    }

    // Request Queue
    @Bean
    public Queue requestQueue() {
        return QueueBuilder.durable(REQUEST_QUEUE).build();
    }

    // Response Queue
    @Bean
    public Queue responseQueue() {
        return QueueBuilder.durable(RESPONSE_QUEUE).build();
    }

    // Request Binding
    @Bean
    public Binding requestBinding() {
        return BindingBuilder
                .bind(requestQueue())
                .to(exchange())
                .with(REQUEST_KEY);
    }

    // Response Binding
    @Bean
    public Binding responseBinding() {
        return BindingBuilder
                .bind(responseQueue())
                .to(exchange())
                .with(RESPONSE_KEY);
    }

    // JSON Converter
    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    // RabbitTemplate
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }
}