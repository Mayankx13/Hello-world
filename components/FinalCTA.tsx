import { book } from "@/lib/content";
import PlateHead from "@/components/PlateHead";
import Reveal from "@/components/Reveal";
import BookingForm from "@/components/BookingForm";

export default function FinalCTA() {
  return (
    <section className="plate book" id="book">
      <div className="plate-inner">
        <PlateHead num={book.num} label={book.label} />
        <div className="book-grid">
          <Reveal>
            <h2 className="display-lg">{book.heading}</h2>
            <p className="scarcity">
              {book.scarcity.body}
              <strong>{book.scarcity.strong}</strong>
              {book.scarcity.tail}
            </p>
            <div className="slot-ledger">
              {book.slots.map((slot) => (
                <div className="slot-row" key={slot.month}>
                  <span className="slot-month">{slot.month}</span>
                  <span className={`slot-state${slot.open ? " open" : ""}`}>
                    {slot.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="slot-foot">{book.slotFoot}</p>
          </Reveal>
          <Reveal className="book-form">
            <BookingForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
