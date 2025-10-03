describe('Cycle de Vie Projet', () => {
  beforeEach(() => {
    // Seed the database before each test
    cy.task('db:seed'); // Assuming you have a task to seed the database
    cy.visit('/');
  });

  afterEach(() => {
    // Clean the database after each test
    cy.task('db:clean'); // Assuming you have a task to clean the database
  });

  it('CRUD complet projet', () => {
    // ----- Create -----
    // Click the create project button
    cy.get('[data-cy=create-project]').click();
    // Type the project name
    cy.get('[data-cy=project-name]').type('Test Projet E2E');
    // Submit the form
    cy.get('[data-cy=submit]').click();
    // Assert that the URL includes '/projects/'
    cy.url().should('include', '/projects/');

    // ----- Read -----
    // Assert that the project title is displayed
    cy.get('[data-cy=project-title]').should('contain', 'Test Projet E2E');

    // ----- Update -----
    // Click the edit project button
    cy.get('[data-cy=edit-project]').click();
    // Type the project description
    cy.get('[data-cy=project-description]').type('Description mise à jour');
    // Save the changes
    cy.get('[data-cy=save]').click();

    // ----- Delete -----
    // Click the delete project button
    cy.get('[data-cy=delete-project]').click();
    // Confirm the deletion
    cy.get('[data-cy=confirm-delete]').click();
    // Assert that the project is not displayed in the project list
    cy.get('[data-cy=project-list]').should('not.contain', 'Test Projet E2E');

  });
});