const fs = require('fs');
const path = 'C:/Users/BIT/Desktop/VANI/frontend/src/app/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const corruptedSection = `    r.onend = () => setListening(false);
          Initializing VANI`;

const correctedSection = `    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setTranscript("Could not understand. Please try again."); };
    recognitionRef.current = r;
    r.start();
  }, []);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);
  const handleMicClick = () => listening ? stopListening() : startListening();

  useEffect(() => {
    if (!listening && transcript.trim() !== "" && transcript !== "Voice recognition not supported." && transcript !== "Could not understand. Please try again.") {
      const processVoice = async () => {
        try {
          const res = await voiceApi.processCommand(transcript);
          const intentData = res.intent || {};
          const intentName = intentData.intent || res.action;

          if (intentName === "search_products") {
            const query = intentData.query || intentData.category || intentData.brand || intentData.color || transcript;
            setSearch(query);
            setSubmittedSearch(query);
          } else if (intentName === "open_cart") {
            setCartOpen(true);
          } else if (intentName === "add_to_cart") {
            const prodName = intentData.product_name;
            if (prodName) {
              const found = allProducts.find(p => p.name.toLowerCase().includes(prodName.toLowerCase()));
              if (found) {
                addItem(found);
                setCartOpen(true);
              } else {
                setTranscript(\`Could not find \${prodName}\`);
                return; // skip auto close
              }
            }
          } else if (intentName === "checkout") {
            setCartOpen(true); // Open cart to allow them to checkout
          }
          
          if (res.message) {
             setTranscript(res.message);
          }
          
          setTimeout(() => setVoiceOpen(false), 3000);
        } catch (e) {
          console.error("Voice process error:", e);
        }
      };
      processVoice();
    }
  }, [listening, transcript, allProducts, addItem]);

  if (appLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#2B201D] text-[#F9F6F0]">
        <Loader color="#E6D5B8" size={60} />
        <div className="mt-8 text-sm tracking-widest uppercase" style={{ fontFamily: "'Crox LightX', sans-serif" }}>
          Initializing VANI`;

if (content.includes(corruptedSection)) {
  content = content.replace(corruptedSection, correctedSection);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully restored App.tsx and wired up Voice Intent parser!');
} else {
  console.log('Could not find corrupted section.');
}
