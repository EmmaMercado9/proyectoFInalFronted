import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FootterComponent } from './footter.component';

describe('FootterComponent', () => {
  let component: FootterComponent;
  let fixture: ComponentFixture<FootterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FootterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FootterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
