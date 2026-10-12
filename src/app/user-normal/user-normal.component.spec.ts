import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserNormalComponent } from './user-normal.component';

describe('UserNormalComponent', () => {
  let component: UserNormalComponent;
  let fixture: ComponentFixture<UserNormalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserNormalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserNormalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
