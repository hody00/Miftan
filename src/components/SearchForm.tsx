export default function SearchForm({
  values,
}: {
  values: Record<string, string | undefined>;
}) {
  return (
    <form className="search-panel" action="/" role="search">
      <div className="search-primary">
        <label className="search-location">
          <span>איפה תרצו לגור?</span>
          <input
            name="city"
            placeholder="עיר, למשל תל אביב"
            defaultValue={values.city}
          />
        </label>
        <label>
          <span>סוג הנכס</span>
          <select name="kind" defaultValue={values.kind || ""}>
            <option value="">השכרה ומכירה</option>
            <option value="rent">להשכרה</option>
            <option value="sale">למכירה</option>
          </select>
        </label>
        <label>
          <span>עד איזה מחיר?</span>
          <input
            name="max"
            type="number"
            min="0"
            max="1000000000"
            placeholder="ללא הגבלה"
            defaultValue={values.max}
          />
        </label>
        <button className="button" type="submit">
          למצוא את הבית שלי <span aria-hidden>←</span>
        </button>
      </div>
      <details
        className="filters"
        open={
          !!(
            values.neighborhood ||
            values.rooms ||
            values.min ||
            values.q ||
            values.days
          )
        }
      >
        <summary>
          דיוק החיפוש <span aria-hidden>＋</span>
        </summary>
        <div className="filter-grid">
          <label>
            שכונה
            <input
              name="neighborhood"
              defaultValue={values.neighborhood}
              placeholder="כל השכונות"
            />
          </label>
          <label>
            מחיר מינימלי
            <input
              type="number"
              min="0"
              max="1000000000"
              name="min"
              defaultValue={values.min}
              placeholder="₪"
            />
          </label>
          <label>
            חדרים ומעלה
            <input
              type="number"
              step="0.5"
              min="0"
              max="30"
              name="rooms"
              defaultValue={values.rooms}
              placeholder="כל גודל"
            />
          </label>
          <label>
            מועד הפרסום
            <select name="days" defaultValue={values.days || ""}>
              <option value="">שלושת הימים האחרונים</option>
              <option value="1">היממה האחרונה</option>
              <option value="2">היומיים האחרונים</option>
            </select>
          </label>
          <label>
            מילות חיפוש
            <input
              name="q"
              defaultValue={values.q}
              placeholder="מרפסת, חניה…"
            />
          </label>
          <label>
            מיון
            <select name="sort" defaultValue={values.sort || "newest"}>
              <option value="newest">החדשות ביותר</option>
              <option value="price_asc">מחיר: מהנמוך לגבוה</option>
              <option value="price_desc">מחיר: מהגבוה לנמוך</option>
            </select>
          </label>
        </div>
        <div className="filter-footer">
          <a href="/">איפוס מסננים</a>
          <button className="button small" type="submit">
            עדכון תוצאות
          </button>
        </div>
      </details>
    </form>
  );
}
