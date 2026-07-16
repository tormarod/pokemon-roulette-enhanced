import { TestBed } from '@angular/core/testing';
import { WhatsNewService } from './whats-new.service';
import { ModalQueueService } from '../modal-queue-service/modal-queue.service';
import { CURRENT_VERSION, RELEASE_NOTES, compareVersions } from '../../data/release-notes';

describe('WhatsNewService', () => {
  let service: WhatsNewService;
  let modalQueue: jasmine.SpyObj<ModalQueueService>;

  beforeEach(() => {
    localStorage.clear();

    const modalQueueSpy = jasmine.createSpyObj('ModalQueueService', ['open']);
    modalQueueSpy.open.and.returnValue(
      Promise.resolve({ result: Promise.resolve() } as any)
    );

    TestBed.configureTestingModule({
      providers: [
        WhatsNewService,
        { provide: ModalQueueService, useValue: modalQueueSpy },
      ],
    });

    service = TestBed.inject(WhatsNewService);
    modalQueue = TestBed.inject(ModalQueueService) as jasmine.SpyObj<ModalQueueService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('on first visit (no localStorage key), should open modal with all RELEASE_NOTES', async () => {
    service.maybeShowOnStartup();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modalQueue.open).toHaveBeenCalled();
    expect(service.pendingEntries).toEqual(RELEASE_NOTES);
    expect(localStorage.getItem('pokemon-roulette-last-seen-version')).toBe(CURRENT_VERSION);
  });

  it('when lastSeenVersion == CURRENT_VERSION, should not open modal', () => {
    localStorage.setItem('pokemon-roulette-last-seen-version', CURRENT_VERSION);

    service.maybeShowOnStartup();

    expect(modalQueue.open).not.toHaveBeenCalled();
  });

  it('when lastSeenVersion < CURRENT_VERSION, should open modal with newer entries only', async () => {
    const olderVersion = '2.0.0';
    localStorage.setItem('pokemon-roulette-last-seen-version', olderVersion);

    service.maybeShowOnStartup();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modalQueue.open).toHaveBeenCalled();
    const newerEntries = RELEASE_NOTES.filter((n) => compareVersions(n.version, olderVersion) > 0);
    expect(service.pendingEntries).toEqual(newerEntries);
  });

  it('after modal closes, should update localStorage to CURRENT_VERSION', async () => {
    localStorage.setItem('pokemon-roulette-last-seen-version', '2.0.0');

    service.maybeShowOnStartup();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(localStorage.getItem('pokemon-roulette-last-seen-version')).toBe(CURRENT_VERSION);
  });

  it('showWhatsNew() should open modal with all RELEASE_NOTES', async () => {
    service.showWhatsNew();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modalQueue.open).toHaveBeenCalled();
    expect(service.pendingEntries).toEqual(RELEASE_NOTES);
  });

  describe('compareVersions', () => {
    it("should return >0 when a > b ('2.10.0' > '2.9.0')", () => {
      expect(compareVersions('2.10.0', '2.9.0')).toBeGreaterThan(0);
    });

    it("should return 0 when a == b ('2.1.0' == '2.1.0')", () => {
      expect(compareVersions('2.1.0', '2.1.0')).toBe(0);
    });

    it("should return <0 when a < b ('2.0.0' < '2.1.0')", () => {
      expect(compareVersions('2.0.0', '2.1.0')).toBeLessThan(0);
    });
  });
});
