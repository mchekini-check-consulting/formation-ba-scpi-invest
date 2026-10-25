package com.example.scpiinvest.logging;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

// Marque une classe (ou une méthode) de la couche service : chaque appel public
// produit un log layer: service (classe, méthode, durée), sans arguments ni valeur
// de retour. Voir LoggableAspect.
//
//   @Loggable
//   @Service
//   public class ItemService { ... }
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
public @interface Loggable {
}
