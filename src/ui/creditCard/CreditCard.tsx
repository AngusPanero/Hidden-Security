import './creditCard.css';

interface CardData {
  tarjetaNumero: string;
  nombre: string;
  añoVencimiento: string;
  mesVencimiento: string;
  cvv: string;
}
interface CreditProps {
  data: CardData;       
  isFlipped: boolean;
}

const CreditCard = ({ data, isFlipped }: CreditProps) => {
  const formatCardNumber = (number: any) => {
    return number ? number.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim() : "#### #### #### ####";
  };

  return (
    <div className={`visual-card-container ${isFlipped ? 'is-flipped' : ''}`}>
      <div className="card-inner">
        
        {/* FRENTE */}
        <div className="card-front">
          <div className="border-glow"></div>
          
          <div className="card-content"> 
            <div className="card-chip"></div>
            {/* <div className="card-brand">VISA</div> */}
            
            <div className="card-number-display">
              {formatCardNumber(data.tarjetaNumero)}
            </div>
            
            <div className="card-bottom-row">
              <div className="card-holder">
                <span className="card-label">Titular</span>
                <div className="card-value">{data.nombre.toUpperCase() || "NOMBRE APELLIDO"}</div>
              </div>
              <div className="card-expiration">
                <span className="card-label">Vence</span>
                <div className="card-value">
                  {data.mesVencimiento || "MM"}/{data.añoVencimiento || "YY"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* REVERSO */}
        <div className="card-back">
          <div className="border-glow"></div>
          
          <div className="card-content"> {/* <-- ESTO FALTABA: Envuelve todo */}
            <div className="magnetic-bar"></div>
            <div className="cvv-section">
              <span className="card-label">CVV</span>
              <div className="cvv-white-bar">
                {data.cvv || "•••"}
              </div>
            </div>
            <div className="card-back-design"></div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default CreditCard;