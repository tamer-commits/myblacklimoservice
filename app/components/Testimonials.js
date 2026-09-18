const testimonials=[
  {quote:"Thanks so much Tamer – really appreciate the great service.",name:"Damien"},
  {quote:"Thank you so much for your kindness and consideration – it sounds like they had a lovely ride with you.",name:"Gigi"}
];
export default function Testimonials(){return <section className="testimonialsSection" aria-label="Client testimonials">
  <h2>WHAT OUR CLIENTS SAY</h2>
  <div className="testimonialsGrid">
    {testimonials.map(({quote,name})=><blockquote key={name} className="testimonialCard">
      <p className="testimonialQuote">“{quote}”</p>
      <cite className="testimonialName">— {name}</cite>
    </blockquote>)}
  </div>
</section>}
