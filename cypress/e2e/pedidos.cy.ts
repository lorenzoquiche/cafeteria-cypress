describe('Pedidos de la cafetería', () => {
  beforeEach(() => {
    cy.request('POST', '/api/test/reset').its('status').should('eq', 200);
    cy.visit('/');
    cy.get('[data-cy="product-espresso"]').should('contain', '8 disponibles');
  });

  it('camino exitoso: crea y consulta el pedido persistido', () => {
    cy.intercept('POST', '/api/orders').as('createOrder');
    cy.get('[data-cy="product-espresso"]').find('button').click();
    cy.get('[data-cy="product-croissant"]').find('button').click();
    cy.get('#quantity-espresso').clear().type('2');
    cy.get('#total').should('have.text', 'Q 58.00');
    cy.get('button').contains('Confirmar pedido').click();
    cy.wait('@createOrder').then(({ request, response }) => {
      expect(request.body.items).to.deep.equal([
        { productId: 'espresso', quantity: 2 },
        { productId: 'croissant', quantity: 1 },
      ]);
      expect(response?.statusCode).to.equal(201);
      const id = response?.body.id;
      expect(id).to.match(/^[0-9a-f-]{36}$/);
      expect(response?.body.totalCents).to.equal(5800);
      cy.request(`/api/orders/${id}`).then(({ status, body }) => {
        expect(status).to.equal(200);
        expect(body.totalCents).to.equal(5800);
        expect(body.items).to.have.length(2);
      });
      cy.get('#status').should('contain', id).and('contain', 'Q 58.00');
      cy.get('#cart-count').should('have.text', '0');
      cy.screenshot('01-camino-exitoso');
    });
  });

  it('validación: carrito vacío y cantidad inválida nunca envían POST', () => {
    let sent = 0;
    cy.intercept('POST', '/api/orders', req => { sent += 1; req.continue(); }).as('unexpectedOrder');
    cy.get('button').contains('Confirmar pedido').click();
    cy.get('#status').should('contain', 'Agrega al menos un producto');
    cy.get('[data-cy="product-espresso"]').find('button').click();
    cy.get('#quantity-espresso').clear().type('9');
    cy.get('#status').should('contain', 'cantidad entera');
    cy.get('button').contains('Confirmar pedido').click();
    cy.get('#status').should('contain', 'Revisa las cantidades');
    cy.then(() => expect(sent).to.equal(0));
    cy.request({ url: '/api/orders/no-existe', failOnStatusCode: false }).its('status').should('eq', 404);
    cy.screenshot('02-validacion');
  });

  it('fallo controlado: una respuesta 503 muestra el error y permite reintentar', () => {
    let first = true;
    cy.intercept('POST', '/api/orders', req => {
      if (first) {
        first = false;
        req.reply({ statusCode: 503, body: { error: 'Servicio temporalmente no disponible.' } });
      } else req.continue();
    }).as('createOrder');
    cy.get('[data-cy="product-capuchino"]').find('button').click();
    cy.get('button').contains('Confirmar pedido').click();
    cy.wait('@createOrder').its('response.statusCode').should('eq', 503);
    cy.get('#status').should('contain', 'Servicio temporalmente no disponible').and('contain', 'intentarlo de nuevo');
    cy.get('#cart-count').should('have.text', '1');
    cy.screenshot('03-error-controlado');
    cy.get('button').contains('Confirmar pedido').click();
    cy.wait('@createOrder').its('response.statusCode').should('eq', 201);
    cy.get('#status').should('contain', '¡Pedido confirmado!');
    cy.get('#cart-count').should('have.text', '0');
    cy.screenshot('03-recuperacion');
  });
});
